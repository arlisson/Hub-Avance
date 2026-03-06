export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido." });
    }

    const { phone, phoneRaw, agent, channel, agendorPick, requestedBy } = req.body || {};
    const phoneDigits = digitsOnly(phone);

    if (phoneDigits.length < 10) {
      return res.status(400).json({ error: "Telefone inválido (com DDD)." });
    }

    const protocol = generateProtocol(phoneDigits);

    // Se o usuário escolheu uma empresa no dropdown, atualiza direto
    if (agendorPick) {
      const agendor = await updateByPick({ agendorPick, protocol });
      if (!agendor.sent) {
        return res.status(502).json({ error: "Falha ao registrar no Agendor.", protocol, agendor });
      }
      return res.status(200).json({ protocol, agendor, sheets: { ok: false, detail: "skip" } });
    }

    // 1) Tenta empresa por telefone
    let found = await findOrganizationByPhoneExact(phoneDigits);

    // 2) Se não achar empresa, tenta pessoa e resolve a empresa vinculada
    if (found.status === "not_found") {
      const person = await findPersonByPhoneExact(phoneDigits);

      if (person.status === "single") {
        const org = await resolveOrganizationFromPerson(person.personId);

        if (org?.organizationId) {
          found = { status: "single", organizationId: org.organizationId };
        } else {
          // Sem empresa vinculada: registra diretamente na pessoa
          const agendor = await updateByPick({
            agendorPick: `person:${person.personId}`,
            protocol,
          });

          if (!agendor.sent) {
            return res.status(502).json({
              error: "Pessoa encontrada, mas falhou ao registrar protocolo na pessoa no Agendor.",
              protocol,
              agendor,
            });
          }

          return res.status(200).json({
            protocol,
            agendor,
            sheets: { ok: false, detail: "skip" },
          });
        }
      } else if (person.status === "multiple") {
        return res.status(409).json({
          error: "Mais de uma pessoa encontrada. Selecione uma.",
          protocol,
          matches: person.matches.map((m) => ({
            key: `person:${m.id}`,
            label: `Pessoa — ${m.name} (ID ${m.id})`,
          })),
          agendor: { sent: false, detail: "multiple_people" },
        });
      } else {
        return res.status(404).json({
          error: "Nenhuma empresa ou pessoa encontrada no Agendor para este telefone.",
          protocol,
        });
      }
    }

    // Se deu múltiplas empresas, pede seleção
    if (found.status === "multiple") {
      return res.status(409).json({
        error: "Mais de uma empresa encontrada. Selecione uma.",
        protocol,
        matches: found.matches.map((m) => ({
          key: `org:${m.id}`,
          label: `Empresa — ${m.name} (ID ${m.id})`,
        })),
        agendor: { sent: false, detail: "multiple_orgs" },
      });
    }

    // Single match: atualiza empresa
    const agendor = await updateByPick({ agendorPick: `org:${found.organizationId}`, protocol });

    if (!agendor.sent) {
      return res.status(502).json({ error: "Falha ao registrar no Agendor.", protocol, agendor });
    }

    return res.status(200).json({ protocol, agendor, sheets: { ok: false, detail: "skip" } });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erro interno." });
  }
}

async function updateByPick({ agendorPick, protocol }) {
  const [kind, id] = String(agendorPick || "").split(":");

  if (!kind || !id) return { sent: false, detail: "Seleção inválida." };

  if (kind === "org") {
    return await updateAgendorOrganizationProtocol({ organizationId: id, protocol });
  }

  if (kind === "person") {
    return await updateAgendorPersonProtocol({ personId: id, protocol });
  }

  return { sent: false, detail: "Tipo não suportado." };
}

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function generateProtocol(phoneDigits) {
  const now = new Date();

  const yy = String(now.getFullYear()).slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  // const mm = String(now.getMinutes()).padStart(2, "0");

  const last4 = String(phoneDigits || "").slice(-4).padStart(4, "0");
  const rand2 = String(Math.floor(Math.random() * 100)).padStart(2, "0");


  return `${yy}${MM}${dd}${hh}${last4}${rand2}`;
}

function normalizePhone(v) {
  return String(v || "").replace(/\D/g, "");
}

function stripBrazilCountryCode(d) {
  const s = String(d || "");
  if (s.startsWith("55") && s.length > 11) return s.slice(2);
  return s;
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

// Varre o objeto inteiro e coleta strings/números que “parecem telefone”
function extractPhoneCandidatesDeep(obj) {
  const out = new Set();

  const visit = (node) => {
    if (node == null) return;

    const t = typeof node;

    if (t === "string" || t === "number") {
      const digits = normalizePhone(node);
      if (digits.length >= 8 && digits.length <= 14) out.add(digits);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (t === "object") {
      Object.keys(node).forEach((k) => visit(node[k]));
    }
  };

  visit(obj);
  return [...out];
}

async function findOrganizationByPhoneExact(phoneDigits) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  if (!token) throw new Error("AGENDOR_API_TOKEN não configurado.");

  const termsToTry = unique([
    phoneDigits,
    `55${phoneDigits}`,
    `+55${phoneDigits}`,
    phoneDigits.slice(-9),
    phoneDigits.slice(-8),
  ]);

  const candidateMap = new Map();

  for (const term of termsToTry) {
    const r = await fetch(`${base}/organizations?term=${encodeURIComponent(term)}&limit=10`, {
      headers: { authorization: `Token ${token}` },
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (Array.isArray(j?.errors) && j.errors[0]) || j?.message || `HTTP ${r.status}`;
      throw new Error(`Falha ao buscar empresas no Agendor: ${msg}`);
    }

    const arr = Array.isArray(j?.data) ? j.data : [];
    for (const o of arr) candidateMap.set(String(o.id), { id: String(o.id), name: o.name || "" });

    if (candidateMap.size >= 10) break;
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 0) return { status: "not_found" };

  const want = normalizePhone(phoneDigits);
  const want55 = normalizePhone(`55${phoneDigits}`);

  const exact = [];

  for (const c of candidates.slice(0, 10)) {
    const detailResp = await fetch(`${base}/organizations/${encodeURIComponent(c.id)}`, {
      headers: { authorization: `Token ${token}` },
    });

    const detailJson = await detailResp.json().catch(() => ({}));
    if (!detailResp.ok) continue;

    const data = detailJson?.data || detailJson;
    const phones = extractPhoneCandidatesDeep(data);

    const isExact =
      phones.includes(want) ||
      phones.includes(want55) ||
      phones.includes(stripBrazilCountryCode(want55)) ||
      phones.includes(stripBrazilCountryCode(want));

    if (isExact) exact.push({ id: c.id, name: data?.name || c.name || "" });
  }

  if (exact.length === 0) return { status: "not_found" };
  if (exact.length === 1) return { status: "single", organizationId: exact[0].id };
  return { status: "multiple", matches: exact };
}

async function findPersonByPhoneExact(phoneDigits) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  if (!token) throw new Error("AGENDOR_API_TOKEN não configurado.");

  const termsToTry = unique([
    phoneDigits,
    `55${phoneDigits}`,
    `+55${phoneDigits}`,
    phoneDigits.slice(-9),
    phoneDigits.slice(-8),
  ]);

  const candidateMap = new Map();

  for (const term of termsToTry) {
    const r = await fetch(`${base}/people?term=${encodeURIComponent(term)}&limit=10`, {
      headers: { authorization: `Token ${token}` },
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (Array.isArray(j?.errors) && j.errors[0]) || j?.message || `HTTP ${r.status}`;
      throw new Error(`Falha ao buscar pessoas no Agendor: ${msg}`);
    }

    const arr = Array.isArray(j?.data) ? j.data : [];
    for (const p of arr) candidateMap.set(String(p.id), { id: String(p.id), name: p.name || "" });

    if (candidateMap.size >= 10) break;
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 0) return { status: "not_found" };

  const want = normalizePhone(phoneDigits);
  const want55 = normalizePhone(`55${phoneDigits}`);

  const exact = [];

  for (const c of candidates.slice(0, 10)) {
    const detailResp = await fetch(`${base}/people/${encodeURIComponent(c.id)}`, {
      headers: { authorization: `Token ${token}` },
    });

    const detailJson = await detailResp.json().catch(() => ({}));
    if (!detailResp.ok) continue;

    const data = detailJson?.data || detailJson;
    const phones = extractPhoneCandidatesDeep(data);

    const isExact =
      phones.includes(want) ||
      phones.includes(want55) ||
      phones.includes(stripBrazilCountryCode(want55)) ||
      phones.includes(stripBrazilCountryCode(want));

    if (isExact) exact.push({ id: c.id, name: data?.name || c.name || "" });
  }

  if (exact.length === 0) return { status: "not_found" };
  if (exact.length === 1) return { status: "single", personId: exact[0].id };
  return { status: "multiple", matches: exact };
}

async function updateAgendorPersonProtocol({ personId, protocol }) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  const identifier = "protocolo_de_atendimento";

  if (!token) return { sent: false, detail: "AGENDOR_API_TOKEN não configurado." };

  const payload = {
    customFields: {
      [identifier]: protocol,
    },
  };

  const r = await fetch(`${base}/people/${encodeURIComponent(personId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Token ${token}`,
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

  return { sent: true, detail: "ok", personId };
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

  return { sent: true, detail: "ok", organizationId };
}

async function resolveOrganizationFromPerson(personId) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  if (!token) throw new Error("AGENDOR_API_TOKEN não configurado.");

  const r = await fetch(`${base}/people/${encodeURIComponent(personId)}`, {
    headers: { authorization: `Token ${token}` },
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) return null;

  const data = j?.data || j;
  const orgIds = extractOrganizationIdsDeep(data);

  if (orgIds.length === 1) return { organizationId: orgIds[0] };
  return null;
}

function extractOrganizationIdsDeep(obj) {
  const out = new Set();

  const visit = (node) => {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== "object") return;

    for (const [k, v] of Object.entries(node)) {
      const key = k.toLowerCase();

      if (key === "organizationid" && (typeof v === "number" || typeof v === "string")) {
        const id = String(v).replace(/\D/g, "");
        if (id.length >= 6) out.add(id);
      }

      if (key.includes("organization") && v && typeof v === "object") {
        if (v.id != null) {
          const id = String(v.id).replace(/\D/g, "");
          if (id.length >= 6) out.add(id);
        }
      }

      visit(v);
    }
  };

  visit(obj);
  return [...out];
}