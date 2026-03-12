// =============================================================================
// Price Check Edge Function — Tavily Extract + Lovable AI for price parsing
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Product {
  id: string;
  name: string;
  urls: Record<string, string>;
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

// ── Tavily: extract page content from URL ──
async function extractPageContent(
  url: string,
  storeName: string,
  tavilyKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(TAVILY_EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        urls: [url],
        extract_depth: 'advanced',
        include_images: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Tavily extract error (${response.status}) for ${storeName}:`, errText);
      return null;
    }

    const data = await response.json();
    const results = data.results;
    if (!results || results.length === 0) {
      console.log(`No content extracted for ${storeName}`);
      return null;
    }

    return results[0].raw_content || results[0].text || null;
  } catch (err) {
    console.error(`Tavily extract failed for ${storeName}:`, err);
    return null;
  }
}

// ── Lovable AI: parse price from extracted content ──
async function parsePriceWithAI(
  content: string,
  productName: string,
  storeName: string,
  lovableApiKey: string,
): Promise<{ price: number; matchedName: string | null } | null> {
  try {
    // Truncate content to avoid token limits
    const truncated = content.substring(0, 8000);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You extract product prices from web page content. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: 'user',
            content: `Find the price in TND (Tunisian Dinar) for "${productName}" in this page content from ${storeName}.

Rules:
- Only match the EXACT model (iPhone 16 ≠ iPhone 16 Pro ≠ iPhone 15)
- 128go = 128 Go = 128GB (same for other capacities)
- Ignore accessories, cases, cables
- If promo price exists, return the promo price
- If multiple color variants, return the cheapest
- Return found:false if the exact product is not found

Return JSON: {"price": number|null, "found": boolean, "product_matched": "string|null"}

Page content:
${truncated}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI parse error (${response.status}) for ${storeName}:`, errText);
      return null;
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    
    // Clean markdown code blocks if present
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.found || !parsed.price) {
      console.log(`${productName} not found on ${storeName}`);
      return null;
    }

    let price = Number(parsed.price);
    if (!isNaN(price) && price > 0) {
      // Handle millimes (some stores return price × 1000)
      if (price > 50000) price = price / 1000;
      if (price >= 50 && price < 50000) {
        console.log(`Found: ${productName} @ ${storeName}: ${price} TND (matched: ${parsed.product_matched || 'N/A'})`);
        return { price: Math.round(price * 100) / 100, matchedName: parsed.product_matched || null };
      }
    }

    console.log(`Invalid price from ${storeName}: ${parsed.price}`);
    return null;
  } catch (err) {
    console.error(`AI price parsing failed for ${productName} @ ${storeName}:`, err);
    return null;
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not configured');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

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

    // Step 1: Extract all pages in parallel via Tavily
    const extractResults = await Promise.allSettled(
      tasks.map(async (task) => {
        const searchUrl = buildStoreSearchUrl(task.store, task.product.name);
        if (!searchUrl) return { ...task, content: null };
        console.log(`Extracting ${task.product.name} @ ${task.storeLabel}...`);
        const content = await extractPageContent(searchUrl, task.storeLabel, TAVILY_API_KEY);
        return { ...task, content };
      })
    );

    // Step 2: Parse prices with AI sequentially (avoid rate limiting)
    const parseResults: Array<{ status: 'fulfilled'; value: any }> = [];
    for (const result of extractResults) {
      if (result.status !== 'fulfilled' || !result.value.content) {
        parseResults.push({
          status: 'fulfilled',
          value: result.status === 'fulfilled'
            ? { ...result.value, price: null, matchedName: null }
            : null,
        });
        continue;
      }
      const { product, store, storeLabel, content } = result.value;
      // Small delay between AI calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
      const parsed = await parsePriceWithAI(content, product.name, storeLabel, LOVABLE_API_KEY);
      parseResults.push({
        status: 'fulfilled',
        value: { product, store, storeLabel, price: parsed?.price || null, matchedName: parsed?.matchedName || null },
      });
    }

    const newPriceEntries: any[] = [];
    const alertCandidates: any[] = [];

    for (const result of parseResults) {
      if (result.status !== 'fulfilled' || !result.value || !result.value.price) continue;
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

        const allPrices: Record<string, number> = {};
        for (const r of parseResults) {
          if (r.status === 'fulfilled' && r.value && r.value.price && r.value.product.id === product.id) {
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

    // Get AI recommendations for alerts
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const newAlerts: any[] = [];
    for (let i = 0; i < alertCandidates.length; i++) {
      const candidate = alertCandidates[i];
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
          if (aiData.recommendation && !aiData.error) {
            recommendation = aiData.recommendation;
          }
        }
      } catch (aiErr) {
        console.error('AI recommendation failed:', aiErr);
      }

      newAlerts.push({
        product_id: candidate.product_id,
        product_name: candidate.product_name,
        store: candidate.store,
        old_price: candidate.old_price,
        new_price: candidate.new_price,
        change_percent: candidate.change_percent,
        direction: candidate.direction,
        recommendation,
      });
    }

    if (newAlerts.length > 0) {
      const { error } = await supabase.from('price_alerts').insert(newAlerts);
      if (error) console.error('Error inserting alerts:', error);

      // Send email notification
      try {
        const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL');
        if (NOTIFICATION_EMAIL) {
          const emailAlerts = newAlerts.map(a => ({
            productName: a.product_name,
            store: a.store,
            oldPrice: a.old_price,
            newPrice: a.new_price,
            changePercent: a.change_percent,
            direction: a.direction,
            recommendation: a.recommendation,
          }));

          const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ alerts: emailAlerts, to: NOTIFICATION_EMAIL }),
          });

          if (emailRes.ok) {
            console.log('Email notification sent successfully');
          } else {
            console.error('Email notification failed:', await emailRes.text());
          }
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }
    }

    // Update monitoring status
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
      message: 'Price check completed (Tavily + AI)',
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
