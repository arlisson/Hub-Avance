// api/agent.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!n8nUrl || !supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_env",
        missing: {
          N8N_WEBHOOK_URL: !n8nUrl,
          SUPABASE_URL: !supabaseUrl,
          SUPABASE_ANON_KEY: !supabaseAnonKey,
        },
      });
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "no_token" });

    // Parse body com segurança (Vercel geralmente já entrega req.body parseado)
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") body = {};

    // Valida token no Supabase
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    const userText = await userResp.text();
    if (!userResp.ok) {
      console.warn("Supabase /auth/v1/user failed:", userResp.status, userText);
      return res.status(401).json({
        ok: false,
        error: "invalid_session",
        status: userResp.status,
        details: safeTruncate(userText),
      });
    }

    let user;
    try {
      user = JSON.parse(userText);
    } catch {
      user = null;
    }

    const email = user?.email || null;

    // Chama n8n
    const n8nResp = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, email }),
    });

    const n8nText = await n8nResp.text();

    if (!n8nResp.ok) {
      console.warn("n8n failed:", n8nResp.status, n8nText);
      return res.status(500).json({
        ok: false,
        error: "n8n_error",
        status: n8nResp.status,
        details: safeTruncate(n8nText),
      });
    }

    res.setHeader("Cache-Control", "no-store");
    // mantém compatível com seu front: devolve exatamente o texto do n8n
    return res.status(200).send(n8nText);
  } catch (e) {
    console.error("api/agent server_error:", e);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}

function safeTruncate(s, n = 800) {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}