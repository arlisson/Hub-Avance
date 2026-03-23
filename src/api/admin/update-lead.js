export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
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

    const { id, atendido } = req.body ?? {};

    if (!id || typeof atendido !== "boolean") {
      return res.status(400).json({ error: "missing_fields" });
    }

    // ── Atualiza o lead ────────────────────────────────────────────────────────
    const updateResp = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ atendido }),
      }
    );

    if (!updateResp.ok) {
      const detail = await updateResp.text();
      return res.status(500).json({ error: "db_error", detail });
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("update lead error:", e);
    return res.status(500).json({ error: "server_error" });
  }
}
