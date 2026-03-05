export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido." });
    }

    // Se você quiser endurecer a segurança depois:
    // 1) validar Authorization: Bearer <jwt> (Supabase)
    // 2) checar permissão do usuário
    // Por enquanto, seguimos sem travar o fluxo.

    const {
      phone,
      phoneRaw,
      agent,
      channel,
      agendorType,
      agendorId,
      requestedBy,
    } = req.body || {};

    const phoneDigits = String(phone || "").replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return res.status(400).json({ error: "Telefone inválido (com DDD)." });
    }

    // Neste passo, vamos preencher no Agendor (Empresa).
    if (agendorType !== "empresa") {
      return res.status(400).json({ error: "Por enquanto, selecione 'Empresa' no Agendor." });
    }
    const orgId = String(agendorId || "").trim();
    if (!orgId) {
      return res.status(400).json({ error: "Informe o ID da Empresa no Agendor." });
    }

    const protocol = generateProtocol(phoneDigits);

    const agendor = await updateAgendorOrganizationProtocol({
      organizationId: orgId,
      protocol,
      meta: { phoneRaw, agent, channel, requestedBy },
    });

    if (!agendor.sent) {
      // Retorna 502 para deixar claro que falhou “no serviço externo”
      return res.status(502).json({
        error: "Falha ao registrar no Agendor.",
        protocol,
        agendor,
      });
    }

    return res.status(200).json({
      protocol,
      agendor,
      sheets: { ok: false, detail: "skip" }, // ainda não implementado
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erro interno." });
  }
}

function generateProtocol(phoneDigits) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const rand2 = String(Math.floor(Math.random() * 100)).padStart(2, "0");

  // TEL-YYYYMMDD-HHMMSS-<telefone>-<rand2>
  return `TEL-${yyyy}${MM}${dd}-${hh}${mm}${ss}-${phoneDigits}-${rand2}`;
}

async function updateAgendorOrganizationProtocol({ organizationId, protocol }) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";

  // Você já confirmou via GET /custom_fields/organizations:
  const identifier = "protocolo_de_atendimento";

  if (!token) {
    return { sent: false, detail: "AGENDOR_API_TOKEN não configurado." };
  }

  const payload = {
    customFields: {
      [identifier]: protocol,
    },
  };

  const r = await fetch(`${base}/organizations/${encodeURIComponent(organizationId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "authorization": `Token ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const msg =
      (Array.isArray(data?.errors) && data.errors[0]) ||
      data?.message ||
      `HTTP ${r.status}`;
    return { sent: false, detail: msg };
  }

  return { sent: true, detail: "ok" };
}