// src/api/register.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { email, password, name, cpf, whatsapp } = req.body || {};
    if (!email || !password || !cpf) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const GS_WEBAPP_URL = process.env.GS_WEBAPP_URL;
    const HUB_SECRET = process.env.HUB_SECRET;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "missing_supabase_env" });
    }
    if (!GS_WEBAPP_URL || !HUB_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_sheets_env" });
    }

    // 1) checa CPF duplicado (service role)
    const cpfCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&cpf=eq.${encodeURIComponent(cpf)}&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      }
    );

    const cpfRows = await cpfCheck.json().catch(() => []);
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
        email_confirm: true,
      }),
    });

    const created = await createUser.json().catch(() => ({}));
    if (!createUser.ok) {
      const msg = created?.msg || created?.message || "create_user_failed";
      return res.status(createUser.status).json({
        ok: false,
        error: "auth_error",
        detail: msg,
      });
    }

    const userId = created.id;

    // 3) atualiza profile (linha criada por trigger)
    const upd = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
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
      }
    );

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

    // 4) registra licença no Google Sheets (upsert)
    const sheetsPayload = {
      action: "upsert_license",
      secret: HUB_SECRET,
      email,
      status: "ACTIVE",
      max_devices: 1,
      created_at: new Date().toISOString(),
    };

    const sheetsResp = await fetch(GS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sheetsPayload),
    });

    const sheetsData = await sheetsResp.json().catch(() => null);

    // Se você NÃO quiser bloquear o cadastro por falha no Sheets, comente este if e apenas faça log
    if (!sheetsResp.ok || !sheetsData?.ok) {
      // rollback: remove usuário criado, já que o cadastro "não completou" o provisionamento
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      // tenta limpar profile também (opcional; geralmente cascade resolve ao deletar user)
      return res.status(502).json({
        ok: false,
        error: "sheets_failed",
        detail: sheetsData || (await sheetsResp.text()),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e) });
  }
}