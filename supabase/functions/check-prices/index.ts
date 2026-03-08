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

async function extractPriceWithAI(content: string, title: string, productName: string, storeName: string): Promise<number | null> {
  // First try regex for obvious prices
  const regexPrice = extractPriceRegex(content, title);
  if (regexPrice) {
    console.log(`Regex found price for ${productName} at ${storeName}: ${regexPrice}`);
    return regexPrice;
  }

  // Fallback to AI extraction with retry on 429
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return null;

    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Extract the selling price in TND (Tunisian Dinar) for the specified product from the given text. Return ONLY the numeric price (e.g. 4299). If you cannot find the exact price, return "null". Do NOT return model numbers, storage sizes, or other numbers — only the actual selling price.' },
            { role: 'user', content: `Product: ${productName}\nStore: ${storeName}\nTitle: ${title}\nContent: ${content.substring(0, 1500)}\n\nWhat is the selling price in TND?` },
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'extract_price',
              description: 'Extract the product price in TND',
              parameters: {
                type: 'object',
                properties: {
                  price: { type: 'number', description: 'The selling price in TND, or null if not found' },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in the extracted price' },
                },
                required: ['price', 'confidence'],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: 'function', function: { name: 'extract_price' } },
        }),
      });

      if (response.status === 429) {
        retries++;
        console.log(`Rate limited, retry ${retries}/${maxRetries} after delay...`);
        await sleep(3000 * retries); // exponential backoff: 3s, 6s, 9s
        continue;
      }

      if (!response.ok) {
        console.error('AI price extraction error:', response.status);
        const text = await response.text();
        console.error('Response:', text);
        return null;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const args = JSON.parse(toolCall.function.arguments);
        if (args.price && args.confidence !== 'low' && args.price >= 100 && args.price < 50000) {
          console.log(`AI found price for ${productName} at ${storeName}: ${args.price} (${args.confidence})`);
          return Math.round(args.price * 100) / 100;
        }
      }
      return null;
    }
    console.error('Max retries exceeded for AI extraction');
  } catch (e) {
    console.error('AI extraction failed:', e);
  }
  return null;
}

function extractPriceRegex(content: string, title: string): number | null {
  const textToSearch = `${title} ${content}`;
  
  // Match prices with currency markers — require at least 4 digits total for electronics
  const patterns = [
    // 4 299,000 DT or 4299.000 DT or 4 299 DT — must have 4+ digit value
    /(\d[\d\s.,]*\d)\s*(?:TND|DT|TTC)\b/gi,
    // Prix: 4299 TND
    /(?:prix|price|tarif)\s*:?\s*(\d[\d\s.,]*\d)\s*(?:TND|DT|TTC)/gi,
  ];

  const candidates: number[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(textToSearch)) !== null) {
      let priceStr = match[1].replace(/\s/g, '');
      // Handle Tunisian format: 4.299,000 → 4299
      if (/^\d{1,3}\.\d{3}/.test(priceStr)) {
        priceStr = priceStr.replace('.', '');
      }
      priceStr = priceStr.replace(',', '.');
      priceStr = priceStr.replace(/\.0{3}$/, '');
      const price = parseFloat(priceStr);
      // Electronics in Tunisia cost at least 1000 TND for phones/laptops
      if (price >= 1000 && price < 50000) {
        candidates.push(price);
      }
    }
  }
  
  if (candidates.length > 0) {
    candidates.sort((a, b) => b - a);
    return Math.round(candidates[0] * 100) / 100;
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
              search_depth: 'basic',
              include_raw_content: false,
              max_results: 3,
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
          for (const result of results) {
            foundPrice = await extractPriceWithAI(result.content, result.title, product.name, store);
            if (foundPrice) break;
          }

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
