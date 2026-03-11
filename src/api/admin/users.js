export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "missing_token" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "missing_env" });
    }

    const adminHeaders = {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    };

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    const authUser = await userResp.json();

    if (!userResp.ok || !authUser?.id) {
      return res.status(401).json({ error: "invalid_token" });
    }

    const profileResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authUser.id}&select=protocol`,
      { headers: adminHeaders }
    );

    const profileData = await profileResp.json();
    const profile = Array.isArray(profileData) ? profileData[0] : null;

    if (!profile?.protocol) {
      return res.status(403).json({ error: "forbidden" });
    }

    const usersResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email,cpf,name,whatsapp,protocol,cliente_avance,app_usage,created_at&order=created_at.desc`,
      { headers: adminHeaders }
    );

    const users = await usersResp.json();

    if (!usersResp.ok) {
      return res.status(500).json({ error: "failed_to_load_users", detail: users });
    }

    return res.status(200).json({ users });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
}