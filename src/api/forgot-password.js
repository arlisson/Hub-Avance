// src/api/forgot-password.js
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const APP_ORIGIN =
      process.env.APP_ORIGIN ||
      req.headers.origin ||
      `https://${req.headers.host}`;

    const RESET_REDIRECT_TO =
      process.env.RESET_REDIRECT_TO || `${APP_ORIGIN}/reset/reset.html`;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "missing_supabase_env" });
    }

    const url =
      `${SUPABASE_URL}/auth/v1/recover` +
      `?redirect_to=${encodeURIComponent(RESET_REDIRECT_TO)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ email }),
    });

    const out = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "recover_failed",
        detail: out?.msg || out?.message || "recover_failed",
      });
    }

    // Não revela se o e-mail existe (boa prática)
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e),
    });
  }
}