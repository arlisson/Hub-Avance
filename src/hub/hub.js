/**
 * hub.js — Hub AVANCE
 *
 * - Guarda de sessão (Supabase) e redireciona para login se não autenticado
 * - Mostra e-mail do usuário no sidebar e no card
 * - Logout
 * - Tema dark/light (persistência em localStorage)
 * - Tracking simples em elementos com data-track
 * - Menu mobile (abre/fecha sidebar, fecha ao clicar fora e com ESC)
 * - Carrega config do agente via /api/public-agent-config (URLs vindas de ENV na Vercel)
 *
 * Requisitos:
 * - window.getSupabaseClient() definido em supabaseClient.js
 */

let AGENT_CHAT_URL = "/apps/agente-chat/index.html";
let LOGIN_URL = "/login/login.html";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Carrega config pública (ENV via Vercel -> /api/public-agent-config)
  await loadPublicAgentConfig();

  // 2) Supabase session guard
  let sb;
  try {
    sb = await window.getSupabaseClient();
  } catch (e) {
    console.error("Supabase client não carregado:", e);
    window.location.href = normalizeLoginUrl(LOGIN_URL);
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = normalizeLoginUrl(LOGIN_URL);
    return;
  }

  const email = sessionData.session.user?.email || "";

  // 3) Mostra email no sidebar e card
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = email;

  const userEmailCardEl = document.getElementById("user-email-card");
  if (userEmailCardEl) userEmailCardEl.textContent = email;

  // 4) Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } finally {
        // limpa estados por sessão (opcional, mas recomendado)
        clearAgentChatSessionStorage();
        window.location.href = normalizeLoginUrl(LOGIN_URL);
      }
    });
  }

  // 5) Tema
  const themeToggle = document.getElementById("theme-toggle");
  initTheme(themeToggle);

  // 6) Tracking (opcional)
  document.querySelectorAll("[data-track]").forEach((el) => {
    el.addEventListener("click", () => {
      const evt = el.getAttribute("data-track");
      console.log("track:", evt);
    });
  });

  // 7) Botão/Card do agente (se existir no DOM)
  //    Opção A: botão com id fixo
  const agentBtn = document.getElementById("open-agent-btn");
  if (agentBtn) agentBtn.addEventListener("click", abrirAgente);

  //    Opção B: qualquer elemento com data-open-agent="true"
  document.querySelectorAll('[data-open-agent="true"]').forEach((el) => {
    el.addEventListener("click", abrirAgente);
  });
});

// -------------------------
// Config do agente (ENV)
// -------------------------
async function loadPublicAgentConfig() {
  try {
    const r = await fetch("/api/public-agent-config", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      if (j.agentChatUrl) AGENT_CHAT_URL = j.agentChatUrl;
      if (j.loginUrl) LOGIN_URL = j.loginUrl;
    }
  } catch (e) {
    // fallback mantém defaults
    console.warn("Falha ao carregar /api/public-agent-config:", e);
  }
}

const agentLink = document.getElementById("open-agent-link");
if (agentLink) {
  agentLink.href = AGENT_CHAT_URL || "/agente-chat/agent.html";

  // Se você quer abrir em nova aba, descomente:
  // agentLink.target = "_blank";
  // agentLink.rel = "noopener noreferrer";
}

function normalizeLoginUrl(url) {
  // Garante URL absoluta (evita problema de path relativo em /hub/hub.html)
  // Se já começar com "http" ou "/", retorna como está.
  if (!url) return "/login/login.html";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url.replace(/^\.?\//, "");
}

function abrirAgente() {
  window.location.href = AGENT_CHAT_URL || "/apps/agente-chat/index.html";
}

// -------------------------
// Tema
// -------------------------
function initTheme(themeToggle) {
  const isDark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  updateThemeIcon(themeToggle, isDark);

  if (!themeToggle) return;
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const nowDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", nowDark ? "dark" : "light");
    updateThemeIcon(themeToggle, nowDark);
  });
}

function updateThemeIcon(themeToggle, isDark) {
  if (!themeToggle) return;
  const icon = themeToggle.querySelector("i");
  const text = themeToggle.querySelector("span");
  if (!icon || !text) return;

  if (isDark) {
    icon.classList.replace("ph-moon", "ph-sun");
    text.textContent = "Modo claro";
  } else {
    icon.classList.replace("ph-sun", "ph-moon");
    text.textContent = "Modo escuro";
  }
}

// -------------------------
// Sidebar mobile
// -------------------------
const menuBtn = document.getElementById("mobile-menu-btn");

menuBtn?.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

// Fecha ao clicar fora
document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("sidebar-open")) return;

  const sidebar = document.querySelector(".sidebar");
  const clickedInsideSidebar = sidebar?.contains(e.target);
  const clickedMenuBtn = menuBtn?.contains(e.target);

  if (!clickedInsideSidebar && !clickedMenuBtn) {
    document.body.classList.remove("sidebar-open");
  }
});

// Fecha com ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("sidebar-open");
});

// -------------------------
// Limpeza opcional de estados por sessão
// -------------------------
function clearAgentChatSessionStorage() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("agente_chat_state:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignora
  }
}