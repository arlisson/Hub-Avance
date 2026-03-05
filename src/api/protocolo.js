export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

    const { phone, phoneRaw, agent, channel, requestedBy } = req.body || {};
    const phoneDigits = String(phone || "").replace(/\D/g, "");

    if (phoneDigits.length < 10) {
      return res.status(400).json({ error: "Telefone inválido (com DDD)." });
    }

    const protocol = generateProtocol(phoneDigits);

    // 1) Buscar empresa no Agendor pelo telefone
    const orgSearch = await findOrganizationByPhone(phoneDigits);

    if (orgSearch.status === "not_found") {
      return res.status(404).json({
        error: "Nenhuma empresa encontrada no Agendor para este telefone.",
        protocol,
        agendor: { sent: false, detail: "not_found" },
      });
    }

    if (orgSearch.status === "multiple") {
      // Opcional: mandar opções para o front escolher
      return res.status(409).json({
        error: "Mais de uma empresa encontrada para este telefone. Selecione uma.",
        protocol,
        agendor: { sent: false, detail: "multiple", matches: orgSearch.matches },
      });
    }

    // 2) Atualizar campo customizado na empresa encontrada
    const agendor = await updateAgendorOrganizationProtocol({
      organizationId: orgSearch.organizationId,
      protocol,
      meta: { phoneRaw, agent, channel, requestedBy },
    });

    if (!agendor.sent) {
      return res.status(502).json({
        error: "Falha ao registrar no Agendor.",
        protocol,
        agendor,
      });
    }

    return res.status(200).json({
      protocol,
      agendor: { sent: true, detail: "ok", organizationId: orgSearch.organizationId },
      sheets: { ok: false, detail: "skip" },
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
  return `TEL-${yyyy}${MM}${dd}-${hh}${mm}${ss}-${phoneDigits}-${rand2}`;
}

async function findOrganizationByPhone(phoneDigits) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  if (!token) throw new Error("AGENDOR_API_TOKEN não configurado.");

  // Busca por termo (o Agendor aceita querystring para pesquisa em listagens)
  // Se sua conta não suportar "term", você troca para o parâmetro que a resposta indicar.
  const url = `${base}/organizations?term=${encodeURIComponent(phoneDigits)}&limit=10`;

  const r = await fetch(url, {
    method: "GET",
    headers: { authorization: `Token ${token}` },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (Array.isArray(data?.errors) && data.errors[0]) || data?.message || `HTTP ${r.status}`;
    throw new Error(`Falha ao buscar empresa no Agendor: ${msg}`);
  }

  const items = Array.isArray(data?.data) ? data.data : [];

  // Filtragem defensiva: procurar empresas que tenham esse telefone em contatos
  // (A estrutura exata do objeto pode variar; por isso, primeiro tentamos por term)
  if (items.length === 0) return { status: "not_found" };
  if (items.length === 1) return { status: "single", organizationId: String(items[0].id) };

  // Se vierem muitas, mande para o front escolher (id + name).
  return {
    status: "multiple",
    matches: items.slice(0, 10).map(o => ({ id: String(o.id), name: o.name || "" })),
  };
}

async function updateAgendorOrganizationProtocol({ organizationId, protocol }) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  const identifier = "protocolo_de_atendimento";
  if (!token) return { sent: false, detail: "AGENDOR_API_TOKEN não configurado." };

  const payload = { customFields: { [identifier]: protocol } };

  const r = await fetch(`${base}/organizations/${encodeURIComponent(organizationId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Token ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (Array.isArray(data?.errors) && data.errors[0]) || data?.message || `HTTP ${r.status}`;
    return { sent: false, detail: msg };
  }
  return { sent: true, detail: "ok" };
}