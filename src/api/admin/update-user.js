export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const { id, protocol, cliente_avance } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "missing_id" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "missing_env" });
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: "return=representation",
    };

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        protocol: !!protocol,
        cliente_avance: !!cliente_avance,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(500).json({ error: "update_failed", detail: data });
    }

    return res.status(200).json({ ok: true, user: data?.[0] || null });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
}