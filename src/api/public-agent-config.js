// api/public-agent-config.js
export default function handler(req, res) {
  const loginUrl = process.env.LOGIN_URL; // ex: "/login/login.html"
  const agentChatUrl = process.env.AGENT_CHAT_URL; // ex: "/apps/agente-chat/index.html"
  const agentProxyUrl = process.env.AGENT_PROXY_URL || "/api/agent"; // ex: "/api/agent"

  if (!loginUrl || !agentChatUrl) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  return res.status(200).json({
    ok: true,
    loginUrl,
    agentChatUrl,
    agentProxyUrl,
  });
}