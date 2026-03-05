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

    // Se o usuário já escolheu uma empresa no dropdown
    if (agendorPick) {
      const agendor = await updateByPick({ agendorPick, protocol });

      if (!agendor.sent) {
        return res.status(502).json({
          error: "Falha ao registrar no Agendor.",
          protocol,
          agendor
        });
      }

      return res.status(200).json({
        protocol,
        agendor,
        sheets: { ok: false, detail: "skip" }
      });
    }

    // Buscar empresa pelo telefone
    
    let found = await findOrganizationByPhoneExact(phoneDigits);

    // Se não encontrou empresa, tenta pessoa
    if (found.status === "not_found") {

      const person = await findPersonByPhoneExact(phoneDigits);

      if (person.status === "single") {

        const org = await resolveOrganizationFromPerson(person.personId);

        if (org?.organizationId) {
          found = { status: "single", organizationId: org.organizationId };
        } else {
          return res.status(404).json({
            error: "Pessoa encontrada, mas sem empresa vinculada no Agendor.",
            protocol
          });
        }
      }

      else if (person.status === "multiple") {
        return res.status(409).json({
          error: "Mais de uma pessoa encontrada. Selecione uma.",
          protocol,
          matches: person.matches.map(m => ({
            key: `person:${m.id}`,
            label: `Pessoa — ${m.name} (ID ${m.id})`
          })),
          agendor: { sent: false, detail: "multiple_people" }
        });
      }

      else {
        return res.status(404).json({
          error: "Nenhuma empresa ou pessoa encontrada no Agendor para este telefone.",
          protocol
        });
      }
    }

    if (found.status === "multiple") {
      return res.status(409).json({
        error: "Mais de uma empresa encontrada. Selecione uma.",
        protocol,
        matches: found.matches.map(m => ({
          key: `org:${m.id}`,
          label: `Empresa — ${m.name} (ID ${m.id})`
        })),
        agendor: { sent: false, detail: "multiple" }
      });
    }

    // Single match
    const agendor = await updateByPick({
      agendorPick: `org:${found.organizationId}`,
      protocol
    });

    if (!agendor.sent) {
      return res.status(502).json({
        error: "Falha ao registrar no Agendor.",
        protocol,
        agendor
      });
    }

    return res.status(200).json({
      protocol,
      agendor,
      sheets: { ok: false, detail: "skip" }
    });

  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erro interno." });
  }
}

async function updateByPick({ agendorPick, protocol }) {
  const [kind, id] = String(agendorPick || "").split(":");

  if (!kind || !id) {
    return { sent: false, detail: "Seleção inválida." };
  }

  if (kind === "org") {
    return await updateAgendorOrganizationProtocol({
      organizationId: id,
      protocol
    });
  }

  return { sent: false, detail: "Tipo não suportado." };
}
function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

// Varre o objeto inteiro e coleta strings/números que “parecem telefone”
function extractPhoneCandidatesDeep(obj) {
  const out = new Set();

  const visit = (node) => {
    if (node == null) return;

    const t = typeof node;

    if (t === "string" || t === "number") {
      const digits = normalizePhone(node);
      // Telefones comuns: 10-13 dígitos (sem +) / 12-13 com 55
      if (digits.length >= 8 && digits.length <= 14) {
        // evita capturar ids pequenos etc: exige que tenha pelo menos 8 dígitos
        out.add(digits);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const it of node) visit(it);
      return;
    }

    if (t === "object") {
      for (const k of Object.keys(node)) visit(node[k]);
    }
  };

  visit(obj);

  return [...out];
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

  return `${dd}${MM}${yyyy}-${hh}${mm}${ss}-${phoneDigits}-${rand2}`;
}

async function findOrganizationByPhoneExact(phoneDigits) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  if (!token) throw new Error("AGENDOR_API_TOKEN não configurado.");

  const termsToTry = unique([
    phoneDigits,
    `55${phoneDigits}`,
    `+55${phoneDigits}`,
    // variações comuns (últimos 8/9 dígitos)
    phoneDigits.slice(-9),
    phoneDigits.slice(-8),
  ]);

  // Coleta candidatos de todas as tentativas (evita perder por causa do formato)
  const candidateMap = new Map();

  for (const term of termsToTry) {
    if (!term) continue;

    const r = await fetch(
      `${base}/organizations?term=${encodeURIComponent(term)}&limit=10`,
      { headers: { authorization: `Token ${token}` } }
    );

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        (Array.isArray(j?.errors) && j.errors[0]) ||
        j?.message ||
        `HTTP ${r.status}`;
      throw new Error(`Falha ao buscar empresas no Agendor: ${msg}`);
    }

    const arr = Array.isArray(j?.data) ? j.data : [];
    for (const o of arr) {
      candidateMap.set(String(o.id), { id: String(o.id), name: o.name || "" });
    }

    // Se já achou candidatos suficientes, não precisa insistir muito
    if (candidateMap.size >= 10) break;
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 0) return { status: "not_found" };

  // Normalizações aceitas para match exato
  const want = normalizePhone(phoneDigits);          // 22981200289
  const want55 = normalizePhone(`55${phoneDigits}`); // 5522981200289

  const exact = [];

  // Para cada candidato, pega detalhes e varre telefones do payload completo
  for (const c of candidates.slice(0, 10)) {
    const id = c.id;

    const detailResp = await fetch(`${base}/organizations/${encodeURIComponent(id)}`, {
      headers: { authorization: `Token ${token}` },
    });

    const detailJson = await detailResp.json().catch(() => ({}));
    if (!detailResp.ok) continue;

    const data = detailJson?.data || detailJson;

    // Coleta todos os “telefones” possíveis via varredura recursiva
    const phones = extractPhoneCandidatesDeep(data);

    // Match exato por equivalência (com/sem 55)
    const isExact =
      phones.includes(want) ||
      phones.includes(want55) ||
      phones.includes(stripBrazilCountryCode(want55)) ||
      phones.includes(stripBrazilCountryCode(want));

    if (isExact) exact.push({ id, name: data?.name || c.name || "" });
  }

  if (exact.length === 0) return { status: "not_found" };
  if (exact.length === 1) return { status: "single", organizationId: exact[0].id };

  return { status: "multiple", matches: exact };
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function collectPhonesFromOrganization(orgData) {
  const out = [];

  const pushAny = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(pushAny);
    else if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (typeof v === "object") {
      if (v.number) out.push(String(v.number));
      if (v.phone) out.push(String(v.phone));
      if (v.value) out.push(String(v.value));
      if (v.whatsapp) out.push(String(v.whatsapp));
    }
  };

  // caminhos prováveis (varia por payload)
  pushAny(orgData?.phones);
  pushAny(orgData?.phone);
  pushAny(orgData?.contact?.phones);
  pushAny(orgData?.contact?.phone);

  return out;
}

function normalizePhone(v) {
  return String(v || "").replace(/\D/g, "");
}

function stripBrazilCountryCode(d) {
  const s = String(d || "");
  if (s.startsWith("55") && s.length > 11) return s.slice(2);
  return s;
}


async function updateAgendorOrganizationProtocol({ organizationId, protocol }) {
  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";
  const identifier = "protocolo_de_atendimento";

  if (!token) return { sent: false, detail: "AGENDOR_API_TOKEN não configurado." };

  const payload = {
    customFields: {
      [identifier]: protocol,
    },
  };

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
    const msg =
      (Array.isArray(data?.errors) && data.errors[0]) ||
      data?.message ||
      `HTTP ${r.status}`;
    return { sent: false, detail: msg };
  }

  return { sent: true, detail: "ok" };
}

async function resolveOrganizationFromPerson(personId) {

  const token = process.env.AGENDOR_API_TOKEN;
  const base = "https://api.agendor.com.br/v3";

  const r = await fetch(`${base}/people/${encodeURIComponent(personId)}`, {
    headers: { authorization: `Token ${token}` },
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) return null;

  const data = j?.data || j;

  const orgIds = extractOrganizationIdsDeep(data);

  if (orgIds.length === 1) {
    return { organizationId: orgIds[0] };
  }

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

    for (const [k,v] of Object.entries(node)) {

      const key = k.toLowerCase();

      if (key === "organizationid" && (typeof v === "number" || typeof v === "string")) {

        const id = String(v).replace(/\D/g,"");

        if (id.length >= 6) out.add(id);
      }

      if (key.includes("organization") && v && typeof v === "object") {

        if (v.id != null) {

          const id = String(v.id).replace(/\D/g,"");

          if (id.length >= 6) out.add(id);
        }
      }

      visit(v);
    }

  };

  visit(obj);

  return [...out];
}