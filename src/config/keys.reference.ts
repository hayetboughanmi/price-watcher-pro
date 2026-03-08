/**
 * ============================================================
 * 🔑 FICHIER DE RÉFÉRENCE — CLÉS API & CONFIGURATION DB
 * ============================================================
 * 
 * ⚠️  IMPORTANT : Ce fichier est une RÉFÉRENCE uniquement.
 *     Les edge functions (backend) lisent les secrets depuis
 *     Lovable Cloud (Deno.env.get), pas depuis ce fichier.
 * 
 *     Pour mettre à jour une clé, demandez dans le chat Lovable :
 *     "Mets à jour ma clé FIRECRAWL_API_KEY"
 * 
 * ============================================================
 */

// -----------------------------------------------
// 🔥 FIRECRAWL — Scraping de prix
// Obtenir une clé : https://firecrawl.dev/
// Utilisé dans : supabase/functions/check-prices
// -----------------------------------------------
export const FIRECRAWL_API_KEY = '';

// -----------------------------------------------
// 🔍 TAVILY — Recherche de prix web
// Obtenir une clé : https://tavily.com/
// Utilisé dans : supabase/functions/check-prices
// -----------------------------------------------
export const TAVILY_API_KEY = '';

// -----------------------------------------------
// 🤖 LOVABLE AI (GPT-5, Gemini) — Recommandations IA
// Clé auto-générée par Lovable Cloud
// Utilisé dans : supabase/functions/ai-recommendation
// -----------------------------------------------
export const LOVABLE_API_KEY = ''; // auto-généré, ne pas modifier

// -----------------------------------------------
// 🗄️ BASE DE DONNÉES — PostgreSQL (Lovable Cloud)
// Gérée automatiquement par Lovable Cloud
// -----------------------------------------------
export const DATABASE_CONFIG = {
  SUPABASE_URL: '',           // ex: https://xqpcr...gwc.supabase.co
  SUPABASE_ANON_KEY: '',      // clé publique
  SUPABASE_SERVICE_ROLE_KEY: '', // clé privée (backend uniquement)
  SUPABASE_DB_URL: '',        // postgresql://postgres:...@db.xqpcr...gwc.supabase.co:5432/postgres
};

// -----------------------------------------------
// 📧 EMAIL — Configuration (à venir)
// -----------------------------------------------
export const EMAIL_CONFIG = {
  SMTP_HOST: '',
  SMTP_PORT: '',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  FROM_EMAIL: '',
};
