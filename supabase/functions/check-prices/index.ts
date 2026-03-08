// =============================================================================
// Price Check Edge Function — Firecrawl JSON Extraction (no separate AI call)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

interface Product {
  id: string;
  name: string;
  urls: Record<string, string>;
}

// ── Firecrawl: scrape + extract price via LLM-powered JSON extraction ──
async function extractPriceFromStore(
  url: string,
  productName: string,
  storeName: string,
  apiKey: string,
): Promise<{ price: number; matchedName: string | null } | null> {
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          prompt: `Find the price in TND (Tunisian Dinar) for the smartphone "${productName}" on this page.
Rules:
- Only match the EXACT model (iPhone 16 ≠ iPhone 16 Pro ≠ iPhone 15)
- 128go = 128 Go = 128GB (same for other capacities)
- Ignore accessories, cases, cables
- If promo price exists, return the promo price
- If multiple color variants, return the cheapest
- Return null if the exact product is not found`,
          schema: {
            type: 'object',
            properties: {
              price: { type: 'number', description: 'Price in TND, or null if not found' },
              found: { type: 'boolean', description: 'Whether the exact product was found' },
              product_matched: { type: 'string', description: 'Name of the product matched' },
            },
            required: ['price', 'found'],
          },
        },
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Firecrawl error (${response.status}) for ${storeName}:`, errText);
      return null;
    }

    const data = await response.json();
    const extracted = data.data?.extract || data.extract;

    if (!extracted || !extracted.found || !extracted.price) {
      console.log(`${productName} not found on ${storeName}`);
      return null;
    }

    const price = Number(extracted.price);
    if (!isNaN(price) && price >= 100 && price < 50000) {
      console.log(`Found: ${productName} @ ${storeName}: ${price} TND (matched: ${extracted.product_matched || 'N/A'})`);
      return { price: Math.round(price * 100) / 100, matchedName: extracted.product_matched || null };
    }

    console.log(`Invalid price from ${storeName}: ${extracted.price}`);
    return null;
  } catch (err) {
    console.error(`Extraction failed for ${productName} @ ${storeName}:`, err);
    return null;
  }
}

// ── Build store search URLs ──
function buildStoreSearchUrl(store: string, productName: string): string | null {
  const query = encodeURIComponent(productName);

  const map: Record<string, string> = {
    tunisianet: `https://www.tunisianet.com.tn/recherche?controller=search&s=${query}&submit_search=`,
    tunisiatech: `https://tunisiatech.tn/recherche?controller=search&s=${query}`,
    spacenet: `https://spacenet.tn/recherche?s=${query}`,
    wiki: `https://www.wiki.tn/recherche?s=${query}`,
  };

  return map[store] || null;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('is_monitored', true);

    if (productsError) throw productsError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: 'No monitored products', checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const storeLabels: Record<string, string> = {
      tunisianet: 'Tunisianet',
      tunisiatech: 'Tunisiatech',
      spacenet: 'SpaceNet',
      wiki: 'Wiki',
    };

    // Build all tasks
    type Task = { product: Product; store: string; storeLabel: string };
    const tasks: Task[] = [];
    for (const product of products as Product[]) {
      for (const [store] of Object.entries(product.urls || {})) {
        tasks.push({ product, store, storeLabel: storeLabels[store] || store });
      }
    }

    // Process ALL in parallel — each Firecrawl call does scrape + extraction
    const results = await Promise.allSettled(
      tasks.map(async ({ product, store, storeLabel }) => {
        const searchUrl = buildStoreSearchUrl(store, product.name);
        if (!searchUrl) return { product, store, storeLabel, price: null, matchedName: null };

        console.log(`Checking ${product.name} @ ${storeLabel}...`);
        const result = await extractPriceFromStore(searchUrl, product.name, storeLabel, FIRECRAWL_API_KEY);
        return { product, store, storeLabel, price: result?.price || null, matchedName: result?.matchedName || null };
      })
    );

    const newPriceEntries: any[] = [];
    const alertCandidates: any[] = [];

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.price) continue;
      const { product, store, storeLabel, price: foundPrice } = result.value;

      newPriceEntries.push({
        product_id: product.id,
        store,
        price: foundPrice,
        currency: 'TND',
        matched_name: result.value.matchedName || null,
      });

      const { data: lastPrice } = await supabase
        .from('price_entries')
        .select('price')
        .eq('product_id', product.id)
        .eq('store', store)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      if (lastPrice && lastPrice.price !== foundPrice) {
        const oldPrice = Number(lastPrice.price);
        const changePercent = ((foundPrice - oldPrice) / oldPrice) * 100;
        const direction = foundPrice < oldPrice ? 'down' : 'up';

        // Gather all current prices for this product across stores
        const allPrices: Record<string, number> = {};
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.price && r.value.product.id === product.id) {
            allPrices[r.value.storeLabel] = r.value.price;
          }
        }

        alertCandidates.push({
          product_id: product.id,
          product_name: product.name,
          store,
          storeLabel,
          old_price: oldPrice,
          new_price: foundPrice,
          change_percent: Math.round(changePercent * 100) / 100,
          direction,
          allPrices,
        });
      }
    }

    if (newPriceEntries.length > 0) {
      const { error } = await supabase.from('price_entries').insert(newPriceEntries);
      if (error) console.error('Error inserting prices:', error);
    }

    // Get AI recommendations for each alert in parallel
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const newAlerts = await Promise.all(
      alertCandidates.map(async (candidate) => {
        let recommendation = candidate.direction === 'down'
          ? `📉 Baisse de ${Math.abs(candidate.change_percent).toFixed(1)}% chez ${candidate.storeLabel}.`
          : `📈 Hausse de ${candidate.change_percent.toFixed(1)}% chez ${candidate.storeLabel}.`;

        try {
          const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-recommendation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              productName: candidate.product_name,
              store: candidate.storeLabel,
              oldPrice: candidate.old_price,
              newPrice: candidate.new_price,
              changePercent: candidate.change_percent,
              direction: candidate.direction,
              allPrices: candidate.allPrices,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.recommendation) {
              recommendation = aiData.recommendation;
            }
          }
        } catch (aiErr) {
          console.error('AI recommendation failed:', aiErr);
        }

        return {
          product_id: candidate.product_id,
          product_name: candidate.product_name,
          store: candidate.store,
          old_price: candidate.old_price,
          new_price: candidate.new_price,
          change_percent: candidate.change_percent,
          direction: candidate.direction,
          recommendation,
        };
      })
    );

    if (newAlerts.length > 0) {
      const { error } = await supabase.from('price_alerts').insert(newAlerts);
      if (error) console.error('Error inserting alerts:', error);
    }

    const { data: monitoringRows } = await supabase
      .from('monitoring_status')
      .select('id, total_checks')
      .limit(1)
      .single();

    if (monitoringRows) {
      await supabase.from('monitoring_status').update({
        last_check: new Date().toISOString(),
        next_check: new Date(Date.now() + 3600000).toISOString(),
        total_checks: (monitoringRows.total_checks || 0) + 1,
      }).eq('id', monitoringRows.id);
    }

    return new Response(JSON.stringify({
      message: 'Price check completed',
      checked: newPriceEntries.length,
      alerts: newAlerts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-prices:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
