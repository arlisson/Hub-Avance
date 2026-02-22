// src/api/register.js
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
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

    // Opcional: defina explicitamente no env
    const APP_ORIGIN =
      process.env.APP_ORIGIN ||
      req.headers.origin ||
      `https://${req.headers.host}`;

    // Para onde o usuário vai após clicar no link de confirmação do e-mail
    const EMAIL_REDIRECT_TO =
      process.env.EMAIL_REDIRECT_TO || `${APP_ORIGIN}/login/login.html`;

    if (!SUPABASE_URL) {
      return res.status(500).json({ ok: false, error: "missing_supabase_url" });
    }
    if (!GS_WEBAPP_URL || !HUB_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "missing_sheets_env",
        has_gs_url: !!GS_WEBAPP_URL,
        has_hub_secret: !!HUB_SECRET,
      });
    }

    // 1) checa CPF duplicado (service role)
    if (!SERVICE_ROLE) {
      return res.status(500).json({
        ok: false,
        error: "missing_supabase_service_role",
      });
    }

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

    // 2) cria usuário via SIGNUP (envia e-mail de confirmação quando o projeto exigir)
    // Não use /admin/users aqui, pois ele não envia confirmação e você estava confirmando automaticamente.
    const signUpResp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE, // pode ser anon key também, mas aqui já temos service role
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          name: name || null,
          cpf,
          whatsapp: whatsapp || null,
        },
        gotrue_meta_security: {},
        // redirect após confirmar e-mail
        options: {
          emailRedirectTo: EMAIL_REDIRECT_TO,
        },
      }),
    });

    const signUpData = await signUpResp.json().catch(() => ({}));
    if (!signUpResp.ok) {
      const msg = signUpData?.msg || signUpData?.message || "signup_failed";
      return res.status(signUpResp.status).json({
        ok: false,
        error: "auth_error",
        detail: msg,
      });
    }

    // GoTrue pode retornar user em "user" ou direto em "id" dependendo do formato.
    const userId = signUpData?.user?.id || signUpData?.id;
    if (!userId) {
      return res.status(500).json({
        ok: false,
        error: "signup_missing_user_id",
        detail: "Supabase signup did not return a user id.",
      });
    }

    // 3) atualiza profile (linha criada por trigger) - usando service role
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

      const detail = await upd.text().catch(() => "");
      return res.status(409).json({
        ok: false,
        error: "profile_update_failed",
        detail,
      });
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

    if (!sheetsResp.ok || !sheetsData?.ok) {
      // rollback: remove usuário criado
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      console.error("Sheets failed:", sheetsData);

      return res.status(502).json({
        ok: false,
        error: "sheets_failed",
        detail: sheetsData || (await sheetsResp.text().catch(() => "")),
      });
    }

    // Observação: quando confirmação de e-mail estiver ativa, sessão geralmente é null
    return res.status(200).json({
      ok: true,
      needs_email_confirmation: true,
      email_redirect_to: EMAIL_REDIRECT_TO,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e),
    });
  }
}