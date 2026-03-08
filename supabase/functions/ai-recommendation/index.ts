// =============================================================================
// AI Recommendation Edge Function for Mytek Price Monitoring
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_RETRIES = 2; // total attempts = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fallbackRecommendation(direction: string, changePercent: number, store: string) {
  return `📊 ${direction === "down" ? "Baisse" : "Hausse"} de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Vérifiez votre positionnement prix.`;
}

async function getOpenAIRecommendation({
  apiKey,
  systemPrompt,
  userPrompt,
}: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ recommendation: string | null; error?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(5000, retryAfterSeconds * 1000)
        : 20000;

      if (attempt < MAX_RETRIES) {
        console.warn(`OpenAI rate-limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      return { recommendation: null, error: "rate_limited" };
    }

    if (response.status === 402) {
      return { recommendation: null, error: "payment_required" };
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      return { recommendation: null, error: `openai_error_${response.status}` };
    }

    const data = await response.json();
    const recommendation = data.choices?.[0]?.message?.content?.trim() || null;

    if (recommendation) {
      return { recommendation };
    }

    return { recommendation: null, error: "empty_response" };
  }

  return { recommendation: null, error: "unknown" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, store, oldPrice, newPrice, changePercent, direction, allPrices } = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const priceContext = allPrices
      ? `Prix actuels chez les concurrents:\n${Object.entries(allPrices).map(([s, p]) => `- ${s}: ${p} TND`).join("\n")}`
      : "";

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
Variation: ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%
Direction: ${direction === "down" ? "BAISSE" : "HAUSSE"}
${priceContext}

Quelle est ta recommandation stratégique pour Mytek ?`;

    const aiResult = await getOpenAIRecommendation({ apiKey, systemPrompt, userPrompt });

    const recommendation = aiResult.recommendation || fallbackRecommendation(direction, changePercent, store);

    return new Response(JSON.stringify({
      recommendation,
      ...(aiResult.error ? { error: aiResult.error } : {}),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommendation error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      recommendation: "⚠️ Recommandation IA indisponible. Vérifiez les prix manuellement.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
