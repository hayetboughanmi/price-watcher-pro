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

function extractPrice(content: string, title: string): number | null {
  // Match Tunisian Dinar prices in various formats
  const patterns = [
    /(\d[\d\s,.]*)\s*(?:TND|DT|دينار)/i,
    /(?:prix|price|سعر)\s*:?\s*(\d[\d\s,.]*)/i,
    /(\d{3,}[.,]\d{3})/,  // e.g. 4,299 or 4.299
    /(\d{3,})\s*(?:TND|DT|dinars?)/i,
  ];

  const textToSearch = `${title} ${content}`;
  
  for (const pattern of patterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/\s/g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (price > 10 && price < 100000) {
        return Math.round(price * 100) / 100;
      }
    }
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

          // Try to extract price from results
          let foundPrice: number | null = null;
          for (const result of results) {
            foundPrice = extractPrice(result.content, result.title);
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

              let recommendation = '';
              if (direction === 'down') {
                recommendation = `📉 Baisse de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Ancien prix: ${oldPrice} TND → Nouveau: ${foundPrice} TND.`;
              } else {
                recommendation = `📈 Hausse de ${changePercent.toFixed(1)}% chez ${store}. Le prix est passé de ${oldPrice} TND à ${foundPrice} TND.`;
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
