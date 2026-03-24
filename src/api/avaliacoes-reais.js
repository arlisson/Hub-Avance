export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { nome, estrelas, comentario } = req.body ?? {};

  if (typeof estrelas !== "number" || estrelas < 0 || estrelas > 5) {
    return res.status(400).json({ error: "invalid_estrelas" });
  }
  if (!comentario || comentario.trim().length < 10) {
    return res.status(400).json({ error: "comentario_required" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: "missing_env" });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/avaliacoes_reais`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey:         SERVICE_ROLE,
        Authorization:  `Bearer ${SERVICE_ROLE}`,
        Prefer:         "return=minimal",
      },
      body: JSON.stringify({
        nome:       nome ?? null,
        estrelas,
        comentario: comentario.trim(),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(500).json({ error: "db_error", detail });
    }

    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("avaliacoes-reais error:", e);
    return res.status(500).json({ error: "server_error" });
  }
}
