// api/agent.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!n8nUrl || !supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "no_token" });

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResp.ok) {
    return res.status(401).json({ ok: false, error: "invalid_session" });
  }

  const user = await userResp.json();
  const email = user?.email || null;

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") body = {};

  const n8nResp = await fetch(n8nUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      email,
    }),
  });

  const text = await n8nResp.text();
  res.setHeader("Cache-Control", "no-store");
  return res.status(n8nResp.ok ? 200 : 500).send(text);
}