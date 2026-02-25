// api/register.js
/**
 * Handles user registration with email, password, and profile information.
 * 
 * This handler performs the following operations in sequence:
 * 1. Validates the request method (POST only)
 * 2. Checks for duplicate CPF in the database
 * 3. Creates a new user account via Supabase Auth
 * 4. Updates the user profile with additional information
 * 5. Registers a license in Google Sheets
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {string} req.method - HTTP method (must be POST or OPTIONS)
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email (required)
 * @param {string} req.body.password - User password (required)
 * @param {string} req.body.cpf - User CPF/ID number (required)
 * @param {string} [req.body.name] - User full name (optional)
 * @param {string} [req.body.whatsapp] - User WhatsApp number (optional)
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} JSON response with status
 * @returns {Object} res.json - Response object
 * @returns {boolean} res.json.ok - Success flag
 * @returns {boolean} [res.json.needs_email_confirmation] - Indicates email confirmation required (on success)
 * @returns {string} [res.json.error] - Error code if failed
 * @returns {string} [res.json.detail] - Error detail message if failed
 * 
 * @throws {Error} Returns 400 if required fields are missing
 * @throws {Error} Returns 405 if request method is not POST
 * @throws {Error} Returns 409 if CPF already exists
 * @throws {Error} Returns 500 if environment variables are missing
 * @throws {Error} Returns 502 if Google Sheets integration fails
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
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
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    const GS_WEBAPP_URL = process.env.GS_WEBAPP_URL;
    const HUB_SECRET = process.env.HUB_SECRET;

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return res.status(500).json({
        ok: false,
        error: "missing_supabase_env",
        has_url: !!SUPABASE_URL,
        has_service_role: !!SERVICE_ROLE,
        has_anon_key: !!ANON_KEY,
      });
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

    // 2) cria usuário (signup normal -> envia e-mail de confirmação quando "Confirm email" estiver habilitado)
    const redirectTo = "https://hub-avance.vercel.app/login/login.html";

    const signUpResp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          name: name || null,
          cpf,
          whatsapp: whatsapp || null,
        },
        redirect_to: redirectTo,
      }),
    });

    const created = await signUpResp.json().catch(() => ({}));
    if (!signUpResp.ok) {
      const msg = created?.msg || created?.message || "signup_failed";
      return res.status(signUpResp.status).json({
        ok: false,
        error: "auth_error",
        detail: msg,
      });
    }

    const userId = created?.user?.id || created?.id;
    if (!userId) {
      return res.status(500).json({ ok: false, error: "missing_user_id" });
    }

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

    // Se você NÃO quiser bloquear o cadastro por falha no Sheets, remova o rollback e apenas faça log.
    if (!sheetsResp.ok || !sheetsData?.ok) {
      // rollback: remove usuário criado
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      console.error("Sheets failed:", sheetsData || (await sheetsResp.text()));

      return res.status(502).json({
        ok: false,
        error: "sheets_failed",
        detail: sheetsData || (await sheetsResp.text()),
      });
    }

    // Retorne um indicador pro frontend mostrar "confirme seu e-mail"
    return res.status(200).json({ ok: true, needs_email_confirmation: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e) });
  }
}