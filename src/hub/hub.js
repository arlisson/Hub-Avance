/**
 * hub.js — Hub AVANCE (cards dinâmicos + modal + menu de configurações)
 *
 * Atualizações:
 * - Captura o user.id da sessão do Supabase
 * - Gera URLs dinâmicas do contador com app, user_id e metric
 * - Registra access para apps online e download para apps baixáveis
 * - Mantém menu, tema, modal, permissões e animações
 */

let LOGIN_URL = "/login/login.html";
let CURRENT_USER_ID = "";

/**
 * Defina seus cards aqui.
 * - youtubeId: apenas o ID do vídeo (não a URL inteira)
 * - actions: botões exibidos no modal
 * - enabled: se false, o card fica indisponível
 * - app: nome do app para enviar ao contador
 * - metric: "access" | "download
 */
const APPS = [
  {
    id: "agent",
    badge: "Mentor estratégico de vendas",
    image: "../img/Apolo.png",
    title: "Mentor estratégico de vendas",
    shortDesc: "Acesse o sistema online. Ideal para uso em qualquer dispositivo.",
    longDesc:
      "Este é o agente mentor estratégico de vendas. Ele permite atendimento e diretamente no navegador, com experiência adaptada para desktop e mobile. Use este produto quando precisar operar de qualquer lugar, sem depender de instalação local.",
    youtubeId: "CNFqPBAdglE",
    enabled: true,
    actions: [
      {
        label: "Acessar",
        icon: "ph-arrow-square-out",
        app: "agent",
        metric: "access",
        primary: true,
        targetBlank: false,
      },
    ],
  },
  {
    id: "desktop",
    badge: "Preenche Fácil",
    image: "../img/PreencheFacil.png",
    title: "Preenche Fácil",
    shortDesc:
      "O Preenche Fácil organiza automaticamente no Excel, funcionando offline na sua máquina.",
    longDesc:
      "O Preenche Fácil é uma ferramenta simples de usar, feita para facilitar sua rotina. Você preenche os dados pelo programa e ele organiza tudo automaticamente no Excel. E pode ficar tranquilo: o programa funciona na sua máquina, sem internet, então suas informações ficam com você. Ninguém tem acesso aos seus dados. Depois de baixar, ele é seu para sempre.",
    youtubeId: "",
    enabled: true,
    actions: [
      {
        label: "Baixar",
        icon: "ph-download-simple",
        app: "desktop",
        metric: "download",
        primary: true,
        targetBlank: true,
      },
    ],
  },
  {
    id: "protocol",
    badge: "Gerador de Protocolo Agendor",
    image: "../img/Protocolo.png",
    title: "Gerador de Protocolo Agendor",
    shortDesc: "Gera e registra protocolos.",
    longDesc: "Ferramenta para geração, registro e envio de protocolos.",
    youtubeId: "",
    enabled: true,
    actions: [
      {
        label: "Acessar",
        icon: "ph-arrow-square-out",
        href:"../protocolo/protocolo.html",
        primary: true,
        targetBlank: false,
      },
    ],
  },
  {
    id: "static-protocol",
    badge: "Gerador de Protocolo",
    image: "../img/Protocolo.png",
    title: "Gerador de Protocolo",
    shortDesc: "Gera novos protocolos.",
    longDesc: "Ferramenta para geração de novos protocolos.",
    youtubeId: "",
    enabled: true,
    actions: [
      {
        label: "Acessar",
        icon: "ph-arrow-square-out",
        app: "protocol",
        metric: "access",
        primary: true,
        targetBlank: false,
      },
    ],
  },
];

// -------------------------
// Busca as avaliações no banco de dados
// -------------------------
async function carregarAvaliacoes(sb) {
  const section = document.querySelector('.hub-testimonials-section');
  const track = document.getElementById("testimonials-track");

  if (!track || !section) return;

  // 1. Mostra um aviso enquanto a internet busca os dados
  track.innerHTML = '<div style="padding: 20px; color: var(--text-primary); opacity: 0.6; font-weight: 500;">Buscando avaliações...</div>';

  try {
    const { data: avaliacoes, error } = await sb
      .from('avaliacoes')
      .select('*')

    if (error) throw error;

    // 2. Se achou avaliações, desenha na tela. Se o banco estiver vazio, esconde a seção.
    if (avaliacoes && avaliacoes.length > 0) {
      renderTestimonials(avaliacoes);
    } else {
      section.style.display = 'none';
    }

  } catch (e) {
    console.error("Falha na conexão com avaliações:", e);
    // 3. Se a internet cair ou der erro, esconde a seção para não ficar um buraco no site
    section.style.display = 'none';
  }
}

// -------------------------
// Renderização dos Depoimentos
// -------------------------
function renderTestimonials(avaliacoes) {
  const track = document.getElementById("testimonials-track");
  if (!track) return;

  let html = "";
  const allTestimonials = [...avaliacoes, ...avaliacoes];

  allTestimonials.forEach((t) => {
    const cor1 = t.cor1 || "#00d4ff";
    const cor2 = t.cor2 || "#0066ff";

    html += `
      <div class="testimonial-card">
        <div class="stars">★★★★★</div>
        <p class="testimonial-text">"${escapeHtml(t.texto)}"</p>
        <div class="testimonial-author">
          <div class="author-avatar" style="background: linear-gradient(135deg, ${cor1}, ${cor2});">${escapeHtml(t.iniciais)}</div>
          <div>
            <div class="author-name">${escapeHtml(t.autor)}</div>
            <div class="author-role">${escapeHtml(t.cargo)}</div>
          </div>
        </div>
      </div>
    `;
  });

  track.innerHTML = html;

  // Ativa a animação CSS de marquee infinita
  // (a duplicação dos itens acima garante o loop perfeito em -50%)
  requestAnimationFrame(() => track.classList.add("iniciada"));

  // Suporte a arrastar com o mouse
  iniciarCarrosselInterativo();
}

// -------------------------
// Suporte a clique & arrasta no carrossel
// -------------------------
function iniciarCarrosselInterativo() {
  const container = document.querySelector(".testimonials-container");
  const track = document.getElementById("testimonials-track");
  if (!container || !track) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  // Pausa a animação CSS ao passar o mouse (já feito via CSS :hover,
  // mas o drag precisa de controle extra)
  container.addEventListener("mouseenter", () => {
    container.classList.add("grab");
  });

  container.addEventListener("mouseleave", () => {
    isDown = false;
    container.classList.remove("grabbing");
    container.classList.remove("grab");
  });

  container.addEventListener("mousedown", (e) => {
    isDown = true;
    container.classList.remove("grab");
    container.classList.add("grabbing");
    // Pausa a animação para arrastar livremente
    track.style.animationPlayState = "paused";
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  container.addEventListener("mouseup", () => {
    isDown = false;
    container.classList.remove("grabbing");
    container.classList.add("grab");
    // Retoma a animação após soltar
    track.style.animationPlayState = "";
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Inicia imediatamente (não dependem de autenticação)
  initNavbarEffect();
  initParticles();
  renderSkeletonCards();

  await loadPublicAgentConfig();

  let sb;
  try {
    sb = await window.getSupabaseClient();
  } catch (e) {
    console.error("Supabase client não carregado:", e);
    window.location.href = normalizeLoginUrl(LOGIN_URL);
    return;
  }

  try {
    const { data: sessionData } = await sb.auth.getSession();

    if (!sessionData?.session) {
      window.location.href = normalizeLoginUrl(LOGIN_URL);
      return;
    }

    CURRENT_USER_ID = sessionData.session.user.id;
    const email = sessionData.session.user?.email || "";

    const { data: profile, error } = await sb
      .from("profiles")
      .select("protocol")
      .eq("id", CURRENT_USER_ID)
      .single();

    if (error) {
      console.error("Erro ao buscar permissões:", error);
    }

    const canAccessProtocol = !!profile?.protocol;

    const menuUsers = document.getElementById("menu-users");
    //console.log("menuUsers encontrado?", !!menuUsers);

    if (menuUsers) {
      menuUsers.hidden = !canAccessProtocol;
    }

    const userEmailEl = document.getElementById("user-email");
    if (userEmailEl) {
      userEmailEl.textContent = email || "";
      userEmailEl.title = email || "";
      userEmailEl.style.cursor = "default";
    }

    const settingsBtn = document.getElementById("settings-btn");
    const settingsMenu = document.getElementById("settings-menu");
    const themeToggle = document.getElementById("theme-toggle");
    const menuLogout = document.getElementById("menu-logout");

    initSettingsMenu(settingsBtn, settingsMenu);
    initTheme(themeToggle);

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

    initMobileSidebar();
    initAppModal();
    renderHubCards({ canAccessProtocol });
    await carregarAvaliacoes(sb);

  } catch (e) {
    console.error("Erro ao inicializar Hub:", e);
    window.location.href = normalizeLoginUrl(LOGIN_URL);
  }
});

// -------------------------
// URLs do contador
// -------------------------
function buildCounterUrl(app, metric = "access") {
  if (!CURRENT_USER_ID || !app) return "#";
  
  const params = new URLSearchParams({
    app,
    user_id: CURRENT_USER_ID,
    metric,
  });

  return `/api/contador?${params.toString()}`;
}

// -------------------------
// Skeleton Loader
// -------------------------
function renderSkeletonCards(count = 3) {
  const grid = document.getElementById("hub-grid");
  if (!grid) return;

  grid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "hub-card-skeleton";
    grid.appendChild(skeleton);
  }
}

// -------------------------
// Renderização dos cards
// -------------------------
function renderHubCards({ canAccessProtocol = false } = {}) {
  const grid = document.getElementById("hub-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const visibleApps = APPS.filter((app) => {
    if (app.id === "protocol" && !canAccessProtocol) return false;
    return true;
  });

  visibleApps.forEach((app) => {
    const card = document.createElement("article");
    card.className = "hub-card" + (app.enabled ? "" : " hub-card-disabled");
    card.setAttribute("data-app-id", app.id);

    if (app.enabled) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Abrir detalhes: ${app.title}`);

      const openModal = () => openAppModal(app.id);
      card.addEventListener("click", openModal);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal();
        }
      });
    }

    const imgTag = app.image
      ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.title || "Aplicação")}">`
      : "";

    card.innerHTML = `
      ${imgTag}
      <div class="hub-card-content">
        <h2 class="hub-card-title">${escapeHtml(app.title || "")}</h2>
        ${app.shortDesc ? `<p class="hub-card-short-desc">${escapeHtml(app.shortDesc)}</p>` : ""}
      </div>
    `;

    grid.appendChild(card);
  });
}

// -------------------------
// Focus Trap (acessibilidade do modal)
// -------------------------
function createFocusTrap(modal) {
  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function handler(e) {
    if (e.key !== "Tab") return;
    const els = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.closest("[hidden]")
    );
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  modal.addEventListener("keydown", handler);
  modal._focusTrapHandler = handler;
}

function removeFocusTrap(modal) {
  if (modal._focusTrapHandler) {
    modal.removeEventListener("keydown", modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAppModal();
  });

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

  if (actionsEl) {
    actionsEl.innerHTML = "";

    (app.actions || []).forEach((a) => {
      const el = document.createElement("a");
      el.className = "hub-btn" + (a.primary ? " hub-btn-primary" : "");
      el.innerHTML = `
        <i class="ph ${escapeHtml(a.icon || "ph-arrow-square-out")}"></i>
        <span>${escapeHtml(a.label || "Abrir")}</span>
      `;

      if (a.app) {
        el.href = buildCounterUrl(a.app, a.metric || "access");
      } else if (a.href) {
        el.href = a.href;
      } else {
        el.href = "#";
      }

      if (a.targetBlank) {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }

      actionsEl.appendChild(el);
    });
  }

  if (videoEl) {
    videoEl.innerHTML = "";

    if (app.youtubeId) {
      const iframe = document.createElement("iframe");
      iframe.allow =
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
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

  createFocusTrap(modal);
  modal.setAttribute("tabindex", "-1");
  modal.focus();
}

function closeAppModal() {
  const backdrop = document.getElementById("app-modal-backdrop");
  const modal = document.getElementById("app-modal");
  const videoEl = document.getElementById("app-modal-video");

  if (videoEl) videoEl.innerHTML = "";

  if (modal) {
    removeFocusTrap(modal);
    modal.hidden = true;
  }
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("modal-open");
}

// -------------------------
// Menu de configurações
// -------------------------
function initSettingsMenu(btn, menu) {
  if (!btn || !menu) return;

  const close = () => {
    menu.hidden = true;
  };

  const open = () => {
    menu.hidden = false;
  };

  const toggle = () => {
    if (menu.hidden) open();
    else close();
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener("click", (e) => {
    const container = document.querySelector(".user-menu-container");
    if (!container) {
      close();
      return;
    }

    if (!container.contains(e.target)) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// -------------------------
// Config pública
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
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return url;
  }
  return "/" + url.replace(/^\.?\//, "");
}

// -------------------------
// Tema
// -------------------------
function initTheme(themeToggle) {
  if (!themeToggle) return;

  if (localStorage.getItem("theme") === "light") {
  document.body.classList.remove("dark-mode");
  updateThemeIcon(themeToggle, false);
} else {
  document.body.classList.add("dark-mode");
  updateThemeIcon(themeToggle, true);
}

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeIcon(themeToggle, isDark);
  });
}

function updateThemeIcon(btn, isDark) {
  const icon = btn?.querySelector("i");
  const text = btn?.querySelector("span");

  if (icon && text) {
    icon.className = isDark ? "ph ph-sun" : "ph ph-moon";
    text.textContent = isDark ? "Modo claro" : "Modo escuro";
  }
}

// -------------------------
// Sidebar
// -------------------------
// -------------------------
// Menu Mobile (Navbar)
// -------------------------
function initMobileSidebar() {
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const navbarLinks = document.querySelector(".navbar-links");

  if (!mobileBtn || !navbarLinks) return;

  // Quando clica no botão do menu
  mobileBtn.addEventListener("click", () => {
    navbarLinks.classList.toggle("active");
    
    // Altera o ícone de Hambúrguer (Lista) para um "X" (Fechar)
    const icon = mobileBtn.querySelector("i");
    if (navbarLinks.classList.contains("active")) {
      icon.className = "ph ph-x";
    } else {
      icon.className = "ph ph-list";
    }
  });

  // Fecha o menu automaticamente se o utilizador clicar num dos links (ex: "Aplicações")
  const links = navbarLinks.querySelectorAll(".nav-link");
  links.forEach(link => {
    link.addEventListener("click", () => {
      navbarLinks.classList.remove("active");
      const icon = mobileBtn.querySelector("i");
      if(icon) icon.className = "ph ph-list";
    });
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

// -------------------------
// Efeito da Navbar
// -------------------------
function initNavbarEffect() {
  const navbar = document.querySelector(".top-navbar");

  if (!navbar) {
    console.warn("Navbar não encontrada pelo script!");
    return;
  }

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (e.clientY <= 30) {
      navbar.classList.add("hover-active");
    } else {
      navbar.classList.remove("hover-active");
    }
  });
}

// ==========================================================
// ANIMAÇÃO DE PARTÍCULAS
// ==========================================================
function initParticles() {
  let canvas = document.getElementById("global-particles");

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "global-particles";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "-10";
    canvas.style.pointerEvents = "none";
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext("2d");
  let particlesArray = [];

  function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  setCanvasSize();

  // Debounce: espera 200ms após parar o resize antes de reinicializar
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setCanvasSize();
      init();
    }, 200);
  });

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1.5;
      this.speedX = (Math.random() - 0.5) * 1.2;
      this.speedY = (Math.random() - 0.5) * 1.2;
      this.opacity = Math.random() * 0.7 + 0.3;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(87, 197, 234, ${this.opacity})`;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(87, 197, 234, 1)";
      ctx.fill();
    }
  }

  function init() {
    particlesArray = [];
    const numberOfParticles = Math.floor((canvas.width * canvas.height) / 8000);

    for (let i = 0; i < numberOfParticles; i++) {
      particlesArray.push(new Particle());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
      particlesArray[i].draw();
    }

    requestAnimationFrame(animate);
  }

  init();
  animate();
}
