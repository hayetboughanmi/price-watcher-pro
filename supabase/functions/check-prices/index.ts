// =============================================================================
// Price Check Edge Function — Tavily + AI Price Extraction + AI Recommendations
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Product {
  id: string;
  name: string;
  urls: Record<string, string>;
}

interface TavilyResult {
  url: string;
  content: string;
  title: string;
  raw_content?: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Use AI to extract the exact price for a specific product from page content
async function extractPriceWithAI(
  content: string,
  productName: string,
  storeName: string,
  apiKey: string,
): Promise<number | null> {
  try {
    // Truncate content to avoid token limits
    const truncated = content.slice(0, 8000);

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es un extracteur de prix. On te donne le contenu d'une page web d'un magasin tunisien et un nom de produit exact.
Tu dois trouver le prix de vente actuel (en TND/DT) de CE PRODUIT EXACT (pas un modèle Pro, Plus, ou une autre variante).
- Si le produit a un prix promotionnel, retourne le prix promo.
- Si le produit n'existe pas sur cette page, retourne "NOT_FOUND".
- Retourne UNIQUEMENT le nombre (ex: 2899) ou "NOT_FOUND". Rien d'autre.`,
          },
          {
            role: "user",
            content: `Produit recherché: "${productName}"
Magasin: ${storeName}

Contenu de la page:
${truncated}`,
          },
        ],
        temperature: 0,
        max_tokens: 20,
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

    // Parse the number
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

    const storeNames: Record<string, string> = {
      tunisianet: 'tunisianet.com.tn',
      tunisiatech: 'tunisiatech.tn',
      spacenet: 'spacenet.tn',
      wiki: 'wiki.tn',
    };

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

      for (const [store, url] of Object.entries(urls)) {
        if (!url) continue;

        try {
          const searchQuery = `${product.name} prix site:${storeNames[store] || store}`;

          // Rate limit: wait before each Tavily call
          await sleep(2000);

          const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query: searchQuery,
              search_depth: 'advanced',
              include_raw_content: true,
              max_results: 3,
              include_domains: [storeNames[store]],
            }),
          });

          if (!tavilyResponse.ok) {
            console.error(`Tavily error for ${product.name} on ${store}: ${tavilyResponse.status}`);
            if (tavilyResponse.status === 432 || tavilyResponse.status === 429) {
              console.log('Rate limited, waiting 5s...');
              await sleep(5000);
            }
            continue;
          }

          const tavilyData = await tavilyResponse.json();
          const results: TavilyResult[] = tavilyData.results || [];

          if (results.length === 0) {
            console.log(`${product.name} @ ${store}: no Tavily results`);
            await sleep(500);
            continue;
          }

          // Combine content for AI extraction
          const allContent = results
            .map(r => `--- ${r.title} ---\n${r.raw_content || r.content}`)
            .join('\n\n');

          const foundPrice = await extractPriceWithAI(
            allContent,
            product.name,
            storeLabels[store] || store,
            LOVABLE_API_KEY,
          );

          console.log(`${product.name} @ ${store}: ${foundPrice ? foundPrice + ' TND' : 'not found'}`);

          await sleep(800);

          if (foundPrice) {
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

              // Get all current prices for AI recommendation context
              const { data: allCurrentPrices } = await supabase
                .from('price_entries')
                .select('store, price')
                .eq('product_id', product.id)
                .order('checked_at', { ascending: false });

              const priceMap: Record<string, number> = {};
              if (allCurrentPrices) {
                for (const p of allCurrentPrices) {
                  if (!priceMap[p.store]) priceMap[p.store] = Number(p.price);
                }
              }
              priceMap[store] = foundPrice;

              // Call AI recommendation
              let recommendation = '';
              try {
                const aiResponse = await fetch(
                  `${SUPABASE_URL}/functions/v1/ai-recommendation`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      productName: product.name,
                      store,
                      oldPrice,
                      newPrice: foundPrice,
                      changePercent,
                      direction,
                      allPrices: priceMap,
                    }),
                  }
                );
                const aiData = await aiResponse.json();
                recommendation = aiData.recommendation || '';
              } catch (aiErr) {
                console.error('AI recommendation error:', aiErr);
                recommendation = direction === 'down'
                  ? `📉 Baisse de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. ${oldPrice} → ${foundPrice} TND.`
                  : `📈 Hausse de ${changePercent.toFixed(1)}% chez ${store}. ${oldPrice} → ${foundPrice} TND.`;
              }

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
