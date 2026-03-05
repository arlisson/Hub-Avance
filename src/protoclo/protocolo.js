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
  const agendorIdEl = document.getElementById("agendorId");

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

  btnClear?.addEventListener("click", () => {
    if (phoneEl) phoneEl.value = "";
    if (agentEl) agentEl.value = "";
    if (agendorIdEl) agendorIdEl.value = "";
    if (agendorTypeEl) agendorTypeEl.value = "";
    if (channelEl) channelEl.value = "whatsapp";

    if (resultBox) resultBox.hidden = true;
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
  });

  btnGenerate?.addEventListener("click", async () => {
    try {
      if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
      if (resultBox) resultBox.hidden = true;

      const phoneRaw = (phoneEl?.value || "").trim();
      const phone = digitsOnly(phoneRaw);

      if (phone.length < 10) {
        throw new Error("Informe um telefone válido com DDD.");
      }

      btnGenerate.disabled = true;

      const payload = {
        phone,
        phoneRaw,
        agent: (agentEl?.value || "").trim(),
        channel: channelEl?.value || "whatsapp",
        agendorType: agendorTypeEl?.value || "",
        agendorId: (agendorIdEl?.value || "").trim(),
        // futuramente: enviar também o usuário logado
        requestedBy: email,
      };

      // opcional: autenticar o endpoint com token Supabase
      // (já que seu Hub é protegido)
      const token = sessionData.session.access_token;

      const resp = await fetch("/api/generate-protocol", {
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

      if (!resp.ok) {
        throw new Error(data?.error || "Falha ao gerar protocolo.");
      }

      const protocol = data.protocol || "";
      if (protoEl) protoEl.textContent = protocol;

      if (sheetStatusEl) sheetStatusEl.textContent = data.sheets?.ok ? "OK" : "Falhou";
      if (agendorStatusEl) agendorStatusEl.textContent = data.agendor?.sent ? "Enviado" : "Não enviado";

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