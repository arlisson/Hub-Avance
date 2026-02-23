export default async function handler(req, res) {
  try {
    const app = String(req.query.app || "").trim();
    if (!app) return res.status(400).send("missing_app");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).send("missing_env");

    // Mapeia app -> URL final (configure via env vars)
    const targets = {
      web: process.env.TARGET_WEB_APP_URL,
      desktop: process.env.TARGET_DESKTOP_URL,

      // NOVO: agente
      // Use uma ENV dedicada, ou reaproveite AGENT_CHAT_URL
      agent: process.env.TARGET_AGENT_URL || process.env.AGENT_CHAT_URL,
    };

    const target = targets[app];
    if (!target) return res.status(400).send("unknown_app");

    // Incremento atômico via RPC
    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_name: app }),
    });

    if (!rpc.ok) {
      const t = await rpc.text();
      console.warn("increment_access failed:", t);
    }

    res.writeHead(302, { Location: target });
    res.end();
  } catch (e) {
    res.status(500).send("server_error");
  }
}