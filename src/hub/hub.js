/**
 * hub.js — Hub AVANCE (cards dinâmicos + modal + menu de configurações no rodapé)
 *
 * Atualizações:
 * - Remove referências a "logout-btn" e "theme-toggle" (agora ficam no menu dropdown)
 * - Suporta menu: botão (3 pontinhos) -> opções: Tema + Sair
 * - Cards: mantém apenas botão "Detalhes"
 * - Modal: continua preenchendo texto, vídeo e botões (Acessar/Baixar) no pop-up
 */

let LOGIN_URL = "/login/login.html";
const COUNTER_AGENT_URL = "/api/contador?app=agent";
const COUNTER_DESKTOP_URL = "/api/contador?app=desktop";

/**
 * Defina seus cards aqui.
 * - youtubeId: apenas o ID do vídeo (não a URL inteira).
 * - actions: botões exibidos no modal.
 * - enabled: se false, o card fica “indisponível”.
 */
const APPS = [
  {
    id: "agent",
    badge: "Agente de suporte | EM PRODUÇÃO",
    icon: "ph-globe",
    title: "Agente Web | EM PRODUÇÃO",
    shortDesc: "Acesse o sistema online. Ideal para uso em qualquer dispositivo.",
    longDesc:
      "Este é o agente de suporte web. Ele permite atendimento e automações diretamente no navegador, com experiência adaptada para desktop e mobile. Use este produto quando precisar operar de qualquer lugar, sem depender de instalação local.",
    youtubeId: "CNFqPBAdglE", // TROQUE pelo seu vídeo (ID)
    enabled: true,
    actions: [
      {
        label: "Acessar",
        icon: "ph-arrow-square-out",
        href: COUNTER_AGENT_URL,
        primary: true,
        targetBlank: false,
      },
    ],
  },
  {
    id: "desktop",
    badge: "Preenche Fácil",
    icon: "ph-desktop",
    title: "Aplicação Desktop",
    shortDesc:
      "O Preenche Fácil organiza automaticamente no Excel, funcionando offline na sua máquina.",
    longDesc:
      "O Preenche Fácil é uma ferramenta simples de usar, feita para facilitar sua rotina. Você preenche os dados pelo programa e ele organiza tudo automaticamente no Excel. E pode ficar tranquilo: o programa funciona na sua máquina, sem internet, então suas informações ficam com você. Ninguém tem acesso aos seus dados. Depois de baixar, ele é seu para sempre.",
    youtubeId: "", // TROQUE pelo seu vídeo (ID)
    enabled: true,
    actions: [
      {
        label: "Baixar",
        icon: "ph-download-simple",
        href: COUNTER_DESKTOP_URL,
        primary: false,
        targetBlank: true,
      },
    ],
  },
  {
    id: "novo-produto",
    badge: "Em breve",
    icon: "ph-rocket-launch",
    title: "Novo Produto",
    shortDesc: "Espaço reservado para próximos aplicativos do hub.",
    longDesc:
      "Este espaço é reservado para novos produtos que serão disponibilizados no hub. Quando estiver pronto, você poderá incluir aqui descrição detalhada e um vídeo de apresentação.",
    youtubeId: "",
    enabled: false,
    actions: [],
  },
];

document.addEventListener("DOMContentLoaded", async () => {
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

  // Toast de boas-vindas (opcional)
  const WELCOME_TOAST = {
    title: "Bem-vindo!",
    message:
      "Seja bem-vindo ao Hub AVANCE. Selecione um produto para ver os detalhes e acessar.",
    durationMs: 0,
  };
  showToast(WELCOME_TOAST);

  // Mostra email no footer (userbar)
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = email;

  // Menu (3 pontinhos)
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const themeToggle = document.getElementById("theme-toggle");
  const menuLogout = document.getElementById("menu-logout");

  initSettingsMenu(settingsBtn, settingsMenu);

  // Tema (agora via item do menu)
  initTheme(themeToggle);

  // Logout (agora via item do menu)
  if (menuLogout) {
    menuLogout.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } finally {
        clearAgentChatSessionStorage();
        window.location.href = normalizeLoginUrl(LOGIN_URL);
      }
    });
  }

  // Sidebar mobile
  initMobileSidebar();

  // Render cards dinâmicos
  renderHubCards();

  // Modal
  initAppModal();
});

// -------------------------
// Renderização dos cards
// -------------------------
function renderHubCards() {
  const grid = document.getElementById("hub-grid");
  if (!grid) return;

  grid.innerHTML = "";

  APPS.forEach((app) => {
    const card = document.createElement("article");
    card.className = "hub-card" + (app.enabled ? "" : " hub-card-disabled");
    card.setAttribute("data-app-id", app.id);

    // Card clicável abre modal (mas não se estiver desabilitado)
    if (app.enabled) {
      card.style.cursor = "pointer";
      card.addEventListener("click", (e) => {
        // Evita abrir modal ao clicar no botão
        const isInteractive = e.target.closest("button,a");
        if (isInteractive) return;
        openAppModal(app.id);
      });
    } else {
      card.style.cursor = "not-allowed";
    }

    // Apenas botão "Detalhes"
    card.innerHTML = `
      <div class="hub-card-top">
        <div class="hub-badge">${escapeHtml(app.badge || "")}</div>
        <div class="hub-icon">
          <i class="ph ${escapeHtml(app.icon || "ph-cube")}"></i>
        </div>
      </div>

      <h2 class="hub-card-title">${escapeHtml(app.title || "")}</h2>
      <p class="hub-card-desc">${escapeHtml(app.shortDesc || "")}</p>

      <div class="hub-card-actions">
        ${
          app.enabled
            ? `
              <button class="hub-btn hub-btn-primary" type="button" data-details="${escapeHtml(
                app.id
              )}">
                <i class="ph ph-info"></i>
                <span>Detalhes</span>
              </button>
            `
            : `
              <button class="hub-btn" type="button" disabled>
                <i class="ph ph-lock"></i>
                <span>Indisponível</span>
              </button>
            `
        }
      </div>
    `;

    grid.appendChild(card);
  });

  // Botão “Detalhes” abre modal
  grid.querySelectorAll("[data-details]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-details");
      openAppModal(id);
    });
  });
}

// -------------------------
// Modal
// -------------------------
function initAppModal() {
  const backdrop = document.getElementById("app-modal-backdrop");
  const modal = document.getElementById("app-modal");
  const closeBtn = document.getElementById("app-modal-close");

  if (!backdrop || !modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeAppModal);

  // Fecha no ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAppModal();
  });

  // Fecha clicando fora
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeAppModal();
  });
}

function openAppModal(appId) {
  const app = APPS.find((a) => a.id === appId);
  if (!app || !app.enabled) return;

  const backdrop = document.getElementById("app-modal-backdrop");
  const modal = document.getElementById("app-modal");
  const badgeEl = document.getElementById("app-modal-badge");
  const titleEl = document.getElementById("app-modal-title");
  const descEl = document.getElementById("app-modal-desc");
  const actionsEl = document.getElementById("app-modal-actions");
  const videoEl = document.getElementById("app-modal-video");

  if (!backdrop || !modal) return;

  if (badgeEl) badgeEl.textContent = app.badge || "";
  if (titleEl) titleEl.textContent = app.title || "";
  if (descEl) descEl.textContent = app.longDesc || "";

  // Botões (Acessar/Baixar) somente no modal
  if (actionsEl) {
    actionsEl.innerHTML = "";
    (app.actions || []).forEach((a) => {
      const el = document.createElement(a.href ? "a" : "button");
      el.className = "hub-btn" + (a.primary ? " hub-btn-primary" : "");
      el.innerHTML = `
        <i class="ph ${escapeHtml(a.icon || "ph-arrow-square-out")}"></i>
        <span>${escapeHtml(a.label || "Abrir")}</span>
      `;

      if (a.href) {
        el.href = a.href;
        if (a.targetBlank) {
          el.target = "_blank";
          el.rel = "noopener noreferrer";
        }
      } else {
        el.type = "button";
      }

      actionsEl.appendChild(el);
    });
  }

  // Vídeo
  if (videoEl) {
    videoEl.innerHTML = "";
    if (app.youtubeId) {
      const iframe = document.createElement("iframe");
      iframe.allow =
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";

      // Versão com menos rastreamento (pode reduzir ruído de logs em alguns cenários)
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        app.youtubeId
      )}`;

      videoEl.appendChild(iframe);
    } else {
      const div = document.createElement("div");
      div.style.padding = "14px";
      div.style.opacity = "0.85";
      div.textContent = "Vídeo de apresentação não disponível.";
      videoEl.appendChild(div);
    }
  }

  backdrop.hidden = false;
  modal.hidden = false;
  document.body.classList.add("modal-open");

  // foco (acessibilidade)
  modal.setAttribute("tabindex", "-1");
  modal.focus();
}

function closeAppModal() {
  const backdrop = document.getElementById("app-modal-backdrop");
  const modal = document.getElementById("app-modal");
  const videoEl = document.getElementById("app-modal-video");

  // remove iframe para parar áudio
  if (videoEl) videoEl.innerHTML = "";

  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("modal-open");
}

// -------------------------
// Menu de configurações (rodapé)
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
    if (!userbar) return close();
    if (!userbar.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// -------------------------
// Config pública (opcional)
// -------------------------
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
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"))
    return url;
  return "/" + url.replace(/^\.?\//, "");
}

// -------------------------
// Tema
// -------------------------
function initTheme(themeToggle) {
  if (!themeToggle) return;

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    updateThemeIcon(themeToggle, true);
  } else {
    updateThemeIcon(themeToggle, false);
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeIcon(themeToggle, isDark);
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
function initMobileSidebar() {
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
}

// -------------------------
// Limpeza opcional
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

// -------------------------
// Toast (boas-vindas)
// -------------------------
function showToast({ title, message, durationMs = 4500, backgroundImage }) {
  const toast = document.getElementById("welcome-toast");
  if (!toast) return;

  const titleEl = document.getElementById("welcome-toast-title");
  const msgEl = document.getElementById("welcome-toast-message");
  const backdrop = document.getElementById("toast-backdrop");
  const closeBtn = document.getElementById("welcome-toast-close");

  if (titleEl) titleEl.textContent = title || "Bem-vindo!";
  if (msgEl) msgEl.textContent = message || "";

  if (backgroundImage) {
    toast.style.backgroundImage = `url("${backgroundImage}")`;
  }

  if (backdrop) backdrop.hidden = false;
  document.body.classList.add("modal-open");

  toast.setAttribute("tabindex", "-1");
  toast.focus();

  toast.hidden = false;
  toast.classList.remove("hide");
  toast.offsetHeight;
  toast.classList.add("show");

  const hide = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");

    window.setTimeout(() => {
      toast.hidden = true;
      if (backdrop) backdrop.hidden = true;
      document.body.classList.remove("modal-open");
    }, 200);
  };

  if (closeBtn) closeBtn.onclick = hide;

  if (durationMs && durationMs > 0) {
    window.setTimeout(hide, durationMs);
  }
}

// -------------------------
// Helpers anti-injeção
// -------------------------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}