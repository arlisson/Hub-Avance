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

    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "missing_user_id" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return res.status(500).json({ error: "missing_env" });
    }

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    const authUser = await userResp.json();

    if (!userResp.ok || !authUser?.id) {
      return res.status(401).json({ error: "invalid_token" });
    }

    const adminHeaders = {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    };

    const profileResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=protocol`,
      { headers: adminHeaders }
    );

    const profileData = await profileResp.json().catch(() => []);
    const profile = Array.isArray(profileData) ? profileData[0] : null;

    if (!profile?.protocol) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (authUser.id === id) {
      return res.status(400).json({ error: "cannot_delete_self" });
    }

    const deleteResp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      }
    );

    if (!deleteResp.ok) {
      const detail = await deleteResp.text().catch(() => "");
      return res.status(500).json({
        error: "delete_failed",
        detail,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("delete user error:", e);
    return res.status(500).json({ error: "server_error" });
  }
}