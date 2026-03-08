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
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const MAX_RETRIES = 0; // fail fast on OpenAI and fallback to Lovable AI

type AIResult = { recommendation: string | null; error?: string; provider?: "openai" | "lovable" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fallbackRecommendation(direction: string, changePercent: number, store: string) {
  return `📊 ${direction === "down" ? "Baisse" : "Hausse"} de ${Math.abs(changePercent).toFixed(1)}% chez ${store}. Vérifiez votre positionnement prix.`;
}

async function callChatCompletion({
  url,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  provider,
  retries = 0,
}: {
  url: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  provider: "openai" | "lovable";
  retries?: number;
}): Promise<AIResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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

      if (attempt < retries) {
        console.warn(`${provider} rate-limited (attempt ${attempt + 1}/${retries + 1}), retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      return { recommendation: null, error: `${provider}_rate_limited`, provider };
    }

    if (response.status === 402) {
      return { recommendation: null, error: `${provider}_payment_required`, provider };
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`${provider} error:`, response.status, errText);
      return { recommendation: null, error: `${provider}_error_${response.status}`, provider };
    }

    const data = await response.json();
    const recommendation = data.choices?.[0]?.message?.content?.trim() || null;

    if (recommendation) {
      return { recommendation, provider };
    }

    return { recommendation: null, error: `${provider}_empty_response`, provider };
  }

  return { recommendation: null, error: `${provider}_unknown`, provider };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, store, oldPrice, newPrice, changePercent, direction, allPrices } = await req.json();

    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    const lovableAIKey = Deno.env.get("LOVABLE_API_KEY");

    if (!openAIKey && !lovableAIKey) {
      throw new Error("Neither OPENAI_API_KEY nor LOVABLE_API_KEY is configured");
    }

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

    const errors: string[] = [];
    let aiResult: AIResult = { recommendation: null };

    if (openAIKey) {
      aiResult = await callChatCompletion({
        url: OPENAI_URL,
        apiKey: openAIKey,
        model: OPENAI_MODEL,
        systemPrompt,
        userPrompt,
        provider: "openai",
        retries: MAX_RETRIES,
      });

      if (aiResult.error) errors.push(aiResult.error);
    }

    if (!aiResult.recommendation && lovableAIKey) {
      const lovableResult = await callChatCompletion({
        url: LOVABLE_AI_URL,
        apiKey: lovableAIKey,
        model: LOVABLE_MODEL,
        systemPrompt,
        userPrompt,
        provider: "lovable",
        retries: 1,
      });

      if (lovableResult.error) errors.push(lovableResult.error);
      if (lovableResult.recommendation) aiResult = lovableResult;
    }

    const recommendation = aiResult.recommendation || fallbackRecommendation(direction, changePercent, store);

    return new Response(JSON.stringify({
      recommendation,
      provider: aiResult.provider || "fallback",
      ...(errors.length ? { error: errors.join("|") } : {}),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommendation error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      recommendation: "⚠️ Recommandation IA indisponible. Vérifiez les prix manuellement.",
      provider: "fallback",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
