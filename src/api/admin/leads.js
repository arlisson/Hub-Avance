export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "missing_token" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return res.status(500).json({ error: "missing_env" });
    }

    // ── Valida sessão ──────────────────────────────────────────────────────────
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    const authUser = await userResp.json();
    if (!userResp.ok || !authUser?.id) {
      return res.status(401).json({ error: "invalid_token" });
    }

    const adminHeaders = {
      "Content-Type": "application/json",
      apikey:         SERVICE_ROLE,
      Authorization:  `Bearer ${SERVICE_ROLE}`,
    };

    // ── Valida permissão de admin ──────────────────────────────────────────────
    const profileResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authUser.id}&select=protocol`,
      { headers: adminHeaders }
    );
    const profileData = await profileResp.json();
    const profile = Array.isArray(profileData) ? profileData[0] : null;
    if (!profile?.protocol) {
      return res.status(403).json({ error: "forbidden" });
    }

    // ── POST: atualiza atendido ────────────────────────────────────────────────
    if (req.method === "POST") {
      const { id, atendido } = req.body ?? {};

      if (!id || typeof atendido !== "boolean") {
        return res.status(400).json({ error: "missing_fields" });
      }

      const updateResp = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`,
        {
          method:  "PATCH",
          headers: { ...adminHeaders, Prefer: "return=minimal" },
          body:    JSON.stringify({ atendido }),
        }
      );

      if (!updateResp.ok) {
        const detail = await updateResp.text();
        return res.status(500).json({ error: "db_error", detail });
      }

      return res.status(200).json({ ok: true });
    }

    // ── GET: lista leads ───────────────────────────────────────────────────────
    const page   = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit || "25", 10)));
    const offset = (page - 1) * limit;

    const search   = (req.query.search  || "").trim();
    const servico  = (req.query.servico  || "").trim();
    const atendido =  req.query.atendido; // "true" | "false" | undefined

    const qs = new URLSearchParams({
      select: "id,created_at,nome,cpf,whatsapp,servico,dados,atendido",
      order:  "created_at.desc",
      limit:  String(limit),
      offset: String(offset),
    });

    if (atendido === "true")  qs.append("atendido", "eq.true");
    if (atendido === "false") qs.append("atendido", "eq.false");
    if (servico)              qs.append("servico",  `ilike.${servico}`);

    if (search) {
      const s = search.replace(/[%_]/g, "\\$&");
      qs.append("or", `(nome.ilike.*${s}*,cpf.ilike.*${s}*,whatsapp.ilike.*${s}*)`);
    }

    const leadsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?${qs.toString()}`,
      { headers: { ...adminHeaders, Prefer: "count=exact" } }
    );

    const leads = await leadsResp.json();

    if (!leadsResp.ok) {
      return res.status(500).json({ error: "failed_to_load_leads", detail: leads });
    }

    const contentRange = leadsResp.headers.get("content-range") || "";
    const total = contentRange.includes("/")
      ? parseInt(contentRange.split("/")[1], 10)
      : (Array.isArray(leads) ? leads.length : 0);

    return res.status(200).json({ leads, total });

  } catch (e) {
    console.error("admin leads error:", e);
    return res.status(500).json({ error: "server_error" });
  }
}
