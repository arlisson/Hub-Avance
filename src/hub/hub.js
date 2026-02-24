/**
 * hub.js — Hub AVANCE (corrigido)
 *
 * Correções:
 * - Não sobrescreve o href do card do agente (mantém /api/contador?app=agent)
 * - Remove referência a variável inexistente TARGET_WEB_APP_URL em abrirAgente()
 */

let LOGIN_URL = "/login/login.html";

// Endpoint do contador (use absoluto para evitar problemas de path)
const COUNTER_AGENT_URL = "/api/contador?app=agent";

document.addEventListener("DOMContentLoaded", async () => {
  // (Opcional) se você usa /api/public-agent-config para centralizar LOGIN_URL
  await loadPublicAgentConfig();

  // Supabase session guard
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

  // Mostra email no sidebar e card
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = email;

  const userEmailCardEl = document.getElementById("user-email-card");
  if (userEmailCardEl) userEmailCardEl.textContent = email;

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } finally {
        clearAgentChatSessionStorage();
        window.location.href = normalizeLoginUrl(LOGIN_URL);
      }
    });
  }

  // Tema
  const themeToggle = document.getElementById("theme-toggle");
  initTheme(themeToggle);

  // Tracking (opcional)
  document.querySelectorAll("[data-track]").forEach((el) => {
    el.addEventListener("click", () => {
      const evt = el.getAttribute("data-track");
      console.log("track:", evt);
    });
  });

  // GARANTIA: o card do agente continua indo para o contador
  const agentLink = document.getElementById("open-agent-link");
  if (agentLink) {
    agentLink.href = COUNTER_AGENT_URL;
    // Se quiser abrir em nova aba, habilite:
    // agentLink.target = "_blank";
    // agentLink.rel = "noopener noreferrer";
  }

  // Se você estiver usando clique via JS em algum lugar:
  const agentBtn = document.getElementById("open-agent-btn");
  if (agentBtn) agentBtn.addEventListener("click", abrirAgente);

  document.querySelectorAll('[data-open-agent="true"]').forEach((el) => {
    el.addEventListener("click", abrirAgente);
  });
});

// -------------------------
// Config pública (opcional)
// -------------------------
/**
 * Loads the public agent configuration from the server.
 * 
 * Fetches the public agent configuration endpoint and updates the global LOGIN_URL
 * if the response is successful and contains a loginUrl property.
 * 
 * @async
 * @function loadPublicAgentConfig
 * @returns {Promise<void>}
 * @throws Will log a warning to console if the fetch fails or if JSON parsing fails
 */
async function loadPublicAgentConfig() {
  try {
    const r = await fetch("/api/public-agent-config", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      if (j.loginUrl) LOGIN_URL = j.loginUrl;
    }
  } catch (e) {
    console.warn("Falha ao carregar /api/public-agent-config:", e);
  }
}

function normalizeLoginUrl(url) {
  if (!url) return "/login/login.html";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url.replace(/^\.?\//, "");
}

function abrirAgente() {
  window.location.href = COUNTER_AGENT_URL;
}

// -------------------------
// Tema
// -------------------------
/**
 * Initializes the theme system for the application.
 * Restores the user's previously saved theme preference from localStorage,
 * applies it to the document, and sets up a click listener for theme toggling.
 * 
 * @param {HTMLElement|null} themeToggle - The DOM element that triggers theme switching.
 *                                         If null or falsy, theme initialization occurs
 *                                         but no event listener is attached.
 * @returns {void}
 * 
 * @example
 * const toggleButton = document.getElementById('theme-toggle');
 * initTheme(toggleButton);
 */
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

/**
 * Updates the theme toggle button's icon and text based on the current theme.
 * @param {HTMLElement} themeToggle - The theme toggle button element
 * @param {boolean} isDark - Whether dark mode is currently enabled
 * @returns {void}
 */
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

document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("sidebar-open")) return;

  const sidebar = document.querySelector(".sidebar");
  const clickedInsideSidebar = sidebar?.contains(e.target);
  const clickedMenuBtn = menuBtn?.contains(e.target);

  if (!clickedInsideSidebar && !clickedMenuBtn) {
    document.body.classList.remove("sidebar-open");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("sidebar-open");
});

// -------------------------
// Limpeza opcional
// -------------------------
/**
 * Clears all agent chat session storage entries.
 * Removes all sessionStorage items that start with the "agente_chat_state:" prefix.
 * Silently catches and ignores any errors that occur during the clearing process.
 */
function clearAgentChatSessionStorage() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("agente_chat_state:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignora
  }
}