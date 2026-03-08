// =============================================================================
// AI Recommendation Edge Function for Mytek Price Monitoring
// =============================================================================
// 
// 🔑 API KEY CONFIGURATION:
// 
// On Lovable Cloud: Uses LOVABLE_API_KEY (auto-configured, no setup needed)
// 
// On VS Code / Local development: You need your own OpenAI API key.
// Set this environment variable in your .env file:
//   OPENAI_API_KEY=sk-your-openai-api-key-here
//
// Get your OpenAI API key at: https://platform.openai.com/api-keys
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable Cloud uses this gateway (auto-configured)
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// VS Code / Local: Replace with OpenAI direct URL
// const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, store, oldPrice, newPrice, changePercent, direction, allPrices } = await req.json();

    // =========================================================================
    // 🔑 VS CODE / LOCAL: Comment the LOVABLE_API_KEY block below and 
    //    uncomment the OPENAI_API_KEY block instead
    // =========================================================================
    
    // --- Lovable Cloud (default) ---
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const aiUrl = LOVABLE_AI_URL;

    // --- VS Code / Local (uncomment this block, comment the block above) ---
    // const apiKey = Deno.env.get("OPENAI_API_KEY");
    // if (!apiKey) throw new Error("OPENAI_API_KEY is not configured. Add it to your .env file.");
    // const aiUrl = "https://api.openai.com/v1/chat/completions";
    // =========================================================================

    const priceContext = allPrices 
      ? `Prix actuels chez les concurrents:\n${Object.entries(allPrices).map(([s, p]) => `- ${s}: ${p} TND`).join('\n')}`
      : '';

    const systemPrompt = `Tu es un assistant stratégique pour Mytek, un revendeur de produits tech en Tunisie.
Tu analyses les prix des concurrents (Tunisianet, Tunisiatech, SpaceNet, Wiki) pour aider Mytek à prendre des décisions de pricing.

Tes recommandations doivent être orientées BUSINESS pour Mytek :
- Aligner le prix si un concurrent est moins cher
- Maintenir le prix si Mytek est compétitif
- Augmenter la marge si les concurrents augmentent
- Identifier les opportunités de marché

Réponds en français, en 2-3 phrases max. Sois direct et actionnable. Utilise des emojis pertinents.`;

    const userPrompt = `Produit: ${productName}
Magasin concurrent: ${store}
Ancien prix concurrent: ${oldPrice} TND
Nouveau prix concurrent: ${newPrice} TND
Variation: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%
Direction: ${direction === 'down' ? 'BAISSE' : 'HAUSSE'}
${priceContext}

Quelle est ta recommandation stratégique pour Mytek ?`;

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ 
        recommendation: `📊 ${direction === 'down' ? 'Baisse' : 'Hausse'} de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Vérifiez votre positionnement prix.`,
        error: "rate_limited" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ 
        recommendation: `📊 ${direction === 'down' ? 'Baisse' : 'Hausse'} de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Vérifiez votre positionnement prix.`,
        error: "payment_required" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const recommendation = data.choices?.[0]?.message?.content || 
      `📊 Variation de ${Math.abs(changePercent).toFixed(1)}% détectée chez ${store}.`;

    return new Response(JSON.stringify({ recommendation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-recommendation error:", e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error",
      recommendation: "⚠️ Recommandation IA indisponible. Vérifiez les prix manuellement."
    }), {
      status: 200, // Return 200 with fallback so the app doesn't break
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
