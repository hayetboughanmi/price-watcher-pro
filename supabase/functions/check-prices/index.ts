// =============================================================================
// Price Check Edge Function — Tavily + AI Recommendations
// =============================================================================
// 
// 🔑 VS CODE / LOCAL: Set these in your .env file:
//   TAVILY_API_KEY=tvly-your-tavily-api-key
//   OPENAI_API_KEY=sk-your-openai-api-key (for AI recommendations)
//
// Get Tavily key at: https://tavily.com
// Get OpenAI key at: https://platform.openai.com/api-keys
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  urls: Record<string, string>;
}

interface TavilyResult {
  url: string;
  content: string;
  title: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPrice(content: string, title: string, productName: string): number | null {
  const textToSearch = `${title} ${content}`;
  
  const patterns = [
    // Prices with currency markers: 4 299,000 DT or 4299 TND
    /(\d[\d\s.,]*\d)\s*(?:TND|DT|TTC|دينار)/gi,
    // Prix: 4299 or Prix: 4 299,000
    /(?:prix|price|tarif)\s*:?\s*(\d[\d\s.,]*\d)/gi,
    // Common e-commerce: 4.299,000 or 4,299.000
    /(\d{1,2}[.,]\d{3}[.,]\d{3})/g,
    // Numbers that look like prices (4 digits+) near product context
    /(\d{1,2}\s?\d{3}(?:[.,]\d{1,3})?)\s*(?:TND|DT|TTC|dinars?)/gi,
  ];

  const candidates: number[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(textToSearch)) !== null) {
      let priceStr = match[1].replace(/\s/g, '');
      // Handle Tunisian format: 4.299,000 → 4299
      if (/^\d{1,3}\.\d{3}/.test(priceStr)) {
        priceStr = priceStr.replace(/\./g, '');
      }
      priceStr = priceStr.replace(',', '.');
      priceStr = priceStr.replace(/\.0{3}$/, '');
      const price = parseFloat(priceStr);
      if (price >= 100 && price < 50000 && !isNaN(price)) {
        candidates.push(price);
      }
    }
  }
  
  if (candidates.length > 0) {
    // Return median price
    candidates.sort((a, b) => a - b);
    const result = candidates[Math.floor(candidates.length / 2)];
    console.log(`Regex found price for ${productName}: ${result} from ${candidates.length} candidates: [${candidates.join(', ')}]`);
    return Math.round(result * 100) / 100;
  }
  
  // Last resort: try to find any 4-digit number in the content
  const lastResort = /\b(\d{4,5})\b/g;
  const nums: number[] = [];
  let m;
  while ((m = lastResort.exec(textToSearch)) !== null) {
    const n = parseInt(m[1]);
    // Filter out years, model numbers etc
    if (n >= 500 && n < 50000 && n > 2030) { // avoid years
      nums.push(n);
    }
  }
  if (nums.length > 0) {
    nums.sort((a, b) => a - b);
    console.log(`Last resort price for ${productName}: ${nums[0]} from [${nums.join(', ')}]`);
    return nums[0];
  }
  
  return null;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) {
      throw new Error('TAVILY_API_KEY is not configured');
    }

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

    const newPriceEntries: any[] = [];
    const newAlerts: any[] = [];

    for (const product of products as Product[]) {
      const urls = product.urls || {};

      for (const [store, url] of Object.entries(urls)) {
        if (!url) continue;

        try {
          // Use Tavily to search for the product price on the specific store
          const searchQuery = `${product.name} prix site:${storeNames[store] || store}`;
          
          const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query: searchQuery,
              search_depth: 'advanced',
              include_raw_content: true,
              max_results: 5,
              include_domains: [storeNames[store]],
            }),
          });

          if (!tavilyResponse.ok) {
            console.error(`Tavily error for ${product.name} on ${store}: ${tavilyResponse.status}`);
            continue;
          }

          const tavilyData = await tavilyResponse.json();
          const results: TavilyResult[] = tavilyData.results || [];

          // Try to extract price from results — combine all content for better context
          let foundPrice: number | null = null;
          // Combine all results content (prefer raw_content for full page data)
          const allContent = results.map(r => `${r.title} ${(r as any).raw_content || r.content}`).join('\n');
          const allTitles = results.map(r => r.title).join(' | ');
          foundPrice = extractPrice(allContent, allTitles, product.name);
          console.log(`${product.name} @ ${store}: ${foundPrice ? foundPrice + ' TND' : 'no price found'} (${results.length} results)`);

          // Add delay between store checks
          await sleep(1000);

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

              // Get all current prices for this product for AI context
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
                  ? `📉 Baisse de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Ancien: ${oldPrice} TND → Nouveau: ${foundPrice} TND.`
                  : `📈 Hausse de ${changePercent.toFixed(1)}% chez ${store}. ${oldPrice} TND → ${foundPrice} TND.`;
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
