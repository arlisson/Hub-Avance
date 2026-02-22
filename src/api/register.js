export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const { email, password, name, cpf, whatsapp } = req.body || {};
    if (!email || !password || !cpf) return res.status(400).json({ ok: false, error: "missing_fields" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "missing_env" });
    }

    // 1) checa CPF duplicado (via REST, usando service role)
    const cpfCheck = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&cpf=eq.${encodeURIComponent(cpf)}&limit=1`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });
    const cpfRows = await cpfCheck.json();
    if (Array.isArray(cpfRows) && cpfRows.length > 0) {
      return res.status(409).json({ ok: false, error: "cpf_exists" });
    }

    // 2) cria usuário (Admin API)
    const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // em produção, você pode deixar true e controlar isso aqui
      }),
    });

    const created = await createUser.json();
    if (!createUser.ok) {
      const msg = created?.msg || created?.message || "create_user_failed";
      // email já existe, etc.
      return res.status(409).json({ ok: false, error: "auth_error", detail: msg });
    }

    const userId = created.id;

    // 3) atualiza profile (linha já existe por trigger; se não existir, faz upsert)
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name: name || null,
        cpf,
        whatsapp: whatsapp || null,
      }),
    });

    if (!upd.ok) {
      // rollback: remove usuário criado
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      const detail = await upd.text();
      return res.status(409).json({ ok: false, error: "profile_update_failed", detail });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e) });
  }
}