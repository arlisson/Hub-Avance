document.addEventListener("DOMContentLoaded", async () => {
  const LOGIN_URL = "/login/login.html";

  // Supabase guard
  let sb;
  try {
    sb = await window.getSupabaseClient();
  } catch {
    window.location.href = LOGIN_URL;
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = LOGIN_URL;
    return;
  }

  const email = sessionData.session.user?.email || "";
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = email;
    userEmailEl.title = email;
  }

  // Menus e tema (padrão)
  initSettingsMenu(
    document.getElementById("settings-btn"),
    document.getElementById("settings-menu")
  );
  initMobileSidebar(document.getElementById("mobile-menu-btn"));
  initTheme(document.getElementById("theme-toggle"));

  // Logout
  const menuLogout = document.getElementById("menu-logout");
  if (menuLogout) {
    menuLogout.addEventListener("click", async () => {
      try { await sb.auth.signOut(); }
      finally { window.location.href = LOGIN_URL; }
    });
  }

  // Form
  const phoneEl = document.getElementById("phone");
  const agentEl = document.getElementById("agent");
  const channelEl = document.getElementById("channel");
  const agendorTypeEl = document.getElementById("agendorType");

  // Picker de empresa (quando houver múltiplas)
  const orgPickerWrap = document.getElementById("orgPickerWrap");
  const orgPicker = document.getElementById("orgPicker");

  const btnGenerate = document.getElementById("btn-generate");
  const btnClear = document.getElementById("btn-clear");

  const resultBox = document.getElementById("result");
  const errorBox = document.getElementById("errorBox");
  const protoEl = document.getElementById("proto");
  const sheetStatusEl = document.getElementById("sheetStatus");
  const agendorStatusEl = document.getElementById("agendorStatus");
  const msgEl = document.getElementById("msg");

  const btnCopyProto = document.getElementById("btn-copy-proto");
  const btnCopyMsg = document.getElementById("btn-copy-msg");

  function hideOrgPicker() {
    if (!orgPickerWrap || !orgPicker) return;
    orgPicker.innerHTML = "";
    orgPickerWrap.hidden = true;
  }

  function showOrgPicker(matches) {
    if (!orgPickerWrap || !orgPicker) return;
    orgPicker.innerHTML = "";

    // placeholder
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Selecione...";
    orgPicker.appendChild(ph);

    for (const m of matches || []) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (ID ${m.id})`;
      orgPicker.appendChild(opt);
    }

    orgPickerWrap.hidden = false;
  }

  btnClear?.addEventListener("click", () => {
    if (phoneEl) phoneEl.value = "";
    if (agentEl) agentEl.value = "";
    if (agendorTypeEl) agendorTypeEl.value = "";
    if (channelEl) channelEl.value = "whatsapp";

    hideOrgPicker();

    if (resultBox) resultBox.hidden = true;
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
  });

  async function callApi(payload) {
    const token = sessionData.session.access_token;

    const resp = await fetch("/api/protocolo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: raw }; }

    return { resp, data };
  }

  btnGenerate?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
      if (resultBox) resultBox.hidden = true;

      const phoneRaw = (phoneEl?.value || "").trim();
      const phone = digitsOnly(phoneRaw);

      if (phone.length < 10) {
        throw new Error("Informe um telefone válido com DDD.");
      }

      const agendorType = agendorTypeEl?.value || "";

      // MVP: empresa
      if (agendorType !== "empresa") {
        throw new Error("Selecione 'Empresa' em 'Tipo no Agendor' (por enquanto).");
      }

      btnGenerate.disabled = true;

      // Se usuário já selecionou uma empresa no picker, usamos esse id
      const selectedOrgId = (orgPicker && !orgPickerWrap.hidden) ? (orgPicker.value || "") : "";

      const payload = {
        phone,
        phoneRaw,
        agent: (agentEl?.value || "").trim(),
        channel: channelEl?.value || "whatsapp",
        agendorType,
        agendorId: selectedOrgId || undefined,
        requestedBy: email,
      };

      const { resp, data } = await callApi(payload);

      // Caso de múltiplas empresas: mostra select e pede para reenviar
      if (resp.status === 409 && Array.isArray(data?.matches)) {
        showOrgPicker(data.matches);

        const maybeProtocol = data?.protocol ? ` Protocolo gerado: ${data.protocol}` : "";
        throw new Error((data?.error || "Mais de uma empresa encontrada.") + maybeProtocol);
      }

      if (!resp.ok) {
        const maybeProtocol = data?.protocol ? `\nProtocolo gerado: ${data.protocol}` : "";
        throw new Error((data?.error || "Falha ao gerar protocolo.") + maybeProtocol);
      }

      // Sucesso: esconde picker (já resolveu)
      hideOrgPicker();

      const protocol = data.protocol || "";
      if (protoEl) protoEl.textContent = protocol;

      if (sheetStatusEl) sheetStatusEl.textContent = "Pendente";
      if (agendorStatusEl) {
        agendorStatusEl.textContent = data.agendor?.sent ? "Enviado" : (data.agendor?.detail || "Não enviado");
      }

      if (msgEl) {
        msgEl.value = buildMessage(protocol);
      }

      if (resultBox) resultBox.hidden = false;

    } catch (e) {
      if (errorBox) {
        errorBox.textContent = e.message || "Erro.";
        errorBox.hidden = false;
      }
    } finally {
      btnGenerate.disabled = false;
    }
  });

  btnCopyProto?.addEventListener("click", async () => {
    const t = protoEl?.textContent || "";
    if (!t) return;
    await navigator.clipboard.writeText(t);
  });

  btnCopyMsg?.addEventListener("click", async () => {
    const t = msgEl?.value || "";
    if (!t) return;
    await navigator.clipboard.writeText(t);
  });
});

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function buildMessage(protocol) {
  return `Seu atendimento foi registrado sob o protocolo ${protocol}. Guarde este número para confirmar a autenticidade em novos contatos.`;
}

// -------------------------
// Padrões do Hub/Agente
// -------------------------
function initSettingsMenu(btn, menu) {
  if (!btn || !menu) return;
  const close = () => (menu.hidden = true);
  const open = () => (menu.hidden = false);
  const toggle = () => (menu.hidden ? open() : close());

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener("click", (e) => {
    const userbar = document.getElementById("sidebar-userbar");
    if (!userbar?.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function initMobileSidebar(menuBtn) {
  if (!menuBtn) return;
  menuBtn.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("sidebar-open")) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar?.contains(e.target) && !menuBtn.contains(e.target)) {
      document.body.classList.remove("sidebar-open");
    }
  });
}

function initTheme(themeToggle) {
  if (!themeToggle) return;

  const isDark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  updateThemeIcon(themeToggle, isDark);

  themeToggle.addEventListener("click", () => {
    const nowDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("theme", nowDark ? "dark" : "light");
    updateThemeIcon(themeToggle, nowDark);
  });
}

function updateThemeIcon(btn, isDark) {
  const icon = btn.querySelector("i");
  const text = btn.querySelector("span");
  if (!icon || !text) return;
  icon.className = isDark ? "ph ph-sun" : "ph ph-moon";
  text.textContent = isDark ? "Modo claro" : "Modo escuro";
}