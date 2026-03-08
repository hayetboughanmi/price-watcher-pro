// =============================================================================
// Price Check Edge Function — Firecrawl Scrape + AI Price Extraction
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

interface Product {
  id: string;
  name: string;
  urls: Record<string, string>;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Firecrawl: scrape a URL and return markdown content ──
async function scrapeWithFirecrawl(
  url: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Firecrawl error (${response.status}) for ${url}:`, errText);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    if (!markdown) {
      console.log(`Firecrawl returned empty content for ${url}`);
      return null;
    }
    return markdown;
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${url}:`, err);
    return null;
  }
}

// ── AI: extract the exact price from page content ──
async function extractPriceWithAI(
  content: string,
  productName: string,
  storeName: string,
  apiKey: string,
): Promise<number | null> {
  try {
    const truncated = content.slice(0, 60000);

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Tu es un extracteur de prix e-commerce ultra précis pour des sites tunisiens.
On te donne le contenu d'une page web et un produit recherché.

RÈGLES IMPORTANTES:
1. Cherche le SMARTPHONE correspondant au produit demandé (pas les accessoires/coques/câbles)
2. Variantes acceptables: "128go" = "128 go" = "128GB" = "128 Go" (idem autres capacités)
3. Si le produit exact n'est pas trouvé mais qu'une variante proche existe (couleur différente), utilise ce prix
4. IGNORE les modèles différents: iPhone 16 ≠ iPhone 16 Pro ≠ iPhone 15
5. Retourne le prix le moins cher en TND si plusieurs variantes
6. Format réponse: uniquement le nombre (ex: 2899) ou NOT_FOUND si introuvable

EXEMPLES:
- Recherche "iPhone 16 128 Go" → trouve "iPhone 16 128 Go Noir à 3299 DT" → réponds "3299"
- Recherche "iPhone 16 128 Go" → trouve seulement "iPhone 16 Pro 256 Go" → réponds "NOT_FOUND"`,
          },
          {
            role: "user",
            content: `Produit recherché: "${productName}"
Magasin: ${storeName}

Contenu de la page:
${truncated}`,
          },
        ],
        max_completion_tokens: 30,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI extraction error (${response.status}):`, errText);
      return null;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || '';

    if (answer === 'NOT_FOUND' || !answer) {
      console.log(`AI says product "${productName}" not found on ${storeName}`);
      return null;
    }

    const cleaned = answer.replace(/[^\d.,]/g, '').replace(',', '.');
    const price = parseFloat(cleaned);

    if (!isNaN(price) && price >= 100 && price < 50000) {
      console.log(`AI extracted price for ${productName} @ ${storeName}: ${price} TND`);
      return Math.round(price * 100) / 100;
    }

    console.log(`AI returned invalid price for ${productName} @ ${storeName}: "${answer}"`);
    return null;
  } catch (err) {
    console.error(`AI extraction failed for ${productName} @ ${storeName}:`, err);
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all monitored products
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

    const newPriceEntries: any[] = [];
    const newAlerts: any[] = [];

    for (const product of products as Product[]) {
      const urls = product.urls || {};
      const storeEntries = Object.entries(urls).filter(([_, url]) => !!url);

      // Process all stores for this product in parallel
      const storeResults = await Promise.allSettled(
        storeEntries.map(async ([store, url]) => {
          const storeLabel = storeLabels[store] || store;
          let foundPrice: number | null = null;

          // 1) Try scraping the store search page (more reliable than direct URLs)
          const searchUrl = buildStoreSearchUrl(store, product.name);
          if (searchUrl) {
            console.log(`Scraping search page for ${product.name} @ ${storeLabel}...`);
            const searchContent = await scrapeWithFirecrawl(searchUrl, FIRECRAWL_API_KEY);
            if (searchContent) {
              foundPrice = await extractPriceWithAI(searchContent, product.name, storeLabel, LOVABLE_API_KEY);
            }
          }

          // 2) Fallback: scrape direct product URL
          if (!foundPrice) {
            console.log(`Scraping direct URL for ${product.name} @ ${storeLabel}...`);
            const directContent = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);
            if (directContent) {
              foundPrice = await extractPriceWithAI(directContent, product.name, storeLabel, LOVABLE_API_KEY);
            }
          }

          console.log(`${product.name} @ ${store}: ${foundPrice ? foundPrice + ' TND' : 'not found'}`);
          return { store, storeLabel, foundPrice };
        })
      );

      for (const result of storeResults) {
        if (result.status !== 'fulfilled' || !result.value.foundPrice) continue;
        const { store, storeLabel, foundPrice } = result.value;
            newPriceEntries.push({
              product_id: product.id,
              store,
              price: foundPrice,
              currency: 'TND',
            });

            // Check for price change vs previous
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

              const recommendation = direction === 'down'
                ? `📉 Baisse de ${Math.abs(changePercent).toFixed(1)}% chez ${storeLabel}. ${oldPrice} → ${foundPrice} TND.`
                : `📈 Hausse de ${changePercent.toFixed(1)}% chez ${storeLabel}. ${oldPrice} → ${foundPrice} TND.`;

              newAlerts.push({
                product_id: product.id,
                product_name: product.name,
                store,
                old_price: oldPrice,
                new_price: foundPrice,
                change_percent: Math.round(changePercent * 100) / 100,
                direction,
                recommendation,
              });
            }
          }
        } catch (storeError) {
          console.error(`Error checking ${store} for ${product.name}:`, storeError);
        }
      }
    }

    // Insert new price entries
    if (newPriceEntries.length > 0) {
      const { error: insertError } = await supabase.from('price_entries').insert(newPriceEntries);
      if (insertError) console.error('Error inserting prices:', insertError);
    }

    // Insert new alerts
    if (newAlerts.length > 0) {
      const { error: alertError } = await supabase.from('price_alerts').insert(newAlerts);
      if (alertError) console.error('Error inserting alerts:', alertError);
    }

    // Update monitoring status
    const { data: monitoringRows } = await supabase
      .from('monitoring_status')
      .select('id, total_checks')
      .limit(1)
      .single();

    if (monitoringRows) {
      await supabase
        .from('monitoring_status')
        .update({
          last_check: new Date().toISOString(),
          next_check: new Date(Date.now() + 3600000).toISOString(),
          total_checks: (monitoringRows.total_checks || 0) + 1,
        })
        .eq('id', monitoringRows.id);
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
