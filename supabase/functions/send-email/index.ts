// =============================================================================
// Send Email Edge Function — Nodemailer SMTP for Price Alert Notifications
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmail {
  productName: string;
  store: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  direction: string;
  recommendation?: string;
}

function buildHtml(alerts: AlertEmail[]): string {
  const alertRows = alerts.map((a) => {
    const color = a.direction === "down" ? "#16a34a" : "#dc2626";
    const arrow = a.direction === "down" ? "📉" : "📈";
    const sign = a.changePercent > 0 ? "+" : "";

    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <strong>${a.productName}</strong><br/>
          <span style="color:#666;font-size:13px;">${a.store}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">
          <span style="color:#999;text-decoration:line-through;">${a.oldPrice.toLocaleString()} TND</span><br/>
          <strong style="color:${color};font-size:16px;">${a.newPrice.toLocaleString()} TND</strong>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">
          <span style="background:${color}15;color:${color};padding:4px 10px;border-radius:12px;font-weight:600;">
            ${arrow} ${sign}${a.changePercent.toFixed(1)}%
          </span>
        </td>
      </tr>
      ${a.recommendation ? `
      <tr>
        <td colspan="3" style="padding:8px 12px 16px;border-bottom:2px solid #eee;">
          <div style="background:#f0f4ff;border:1px solid #d0d9f0;border-radius:8px;padding:12px;">
            <div style="font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
              🤖 Recommandation IA
            </div>
            <div style="font-size:13px;color:#333;line-height:1.5;">${a.recommendation}</div>
          </div>
        </td>
      </tr>` : ""}`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 30px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">🔔 Mytek — Alertes Prix</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${alerts.length} changement${alerts.length > 1 ? "s" : ""} de prix détecté${alerts.length > 1 ? "s" : ""}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Produit</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;">Prix</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;">Variation</th>
        </tr>
      </thead>
      <tbody>
        ${alertRows}
      </tbody>
    </table>
    <div style="padding:20px 30px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #eee;">
      Mytek Price Monitor — Généré automatiquement
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT") || "587";
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
    const FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !FROM_EMAIL) {
      throw new Error("SMTP configuration is incomplete. Check secrets.");
    }

    const { alerts, to } = await req.json() as { alerts: AlertEmail[]; to: string | string[] };

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ message: "No alerts to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0 || !recipients[0]) {
      throw new Error("No recipient email provided");
    }

    const port = parseInt(SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });

    const subject = `🔔 Mytek — ${alerts.length} alerte${alerts.length > 1 ? "s" : ""} prix`;
    const html = buildHtml(alerts);

    for (const recipient of recipients) {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        text: "Veuillez utiliser un client email supportant le HTML.",
        html,
      });
      console.log(`Email sent to ${recipient}`);
    }

    return new Response(JSON.stringify({ 
      message: `Email sent to ${recipients.length} recipient(s)`,
      recipients: recipients.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("send-email error:", e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
