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
    badge: "Consultora estratégica de vendas",
    image: "../img/Ludmilla.png",
    title: "Consultora estratégica de vendas",
    shortDesc: "Acesse o sistema online. Ideal para uso em qualquer dispositivo.",
    longDesc:
      "Este é o agente consultor estratégico de vendas. Ele permite atendimento e automações diretamente no navegador, com experiência adaptada para desktop e mobile. Use este produto quando precisar operar de qualquer lugar, sem depender de instalação local.",
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
    image: "../img/PreencheFacil.png",
    title: "Preenche Fácil",
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
    id: "protocol",
    badge: "Gerador de Protocolo",
    image: "../img/protocolo.png",
    title: "Gerador de Protocolo",
    shortDesc: "Gera e registra protocolos.",
    longDesc: "Ferramenta para geração, registro e envio de protocolos.",
    youtubeId: "",
    enabled: true,
    actions: [
      {
        label: "Acessar",
        icon: "ph-arrow-square-out",
        href: "../protocolo/protocolo.html",
        primary: true,
        targetBlank: false,
      },
    ],
  },
  {
    id: "novo-produto",
    badge: "Em breve",
    image: "",
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

   const { data: profile, error } = await sb
    .from("profiles")
    .select("protocol")
    .eq("id", sessionData.session.user.id)
    .single();

  if (error) {
    console.error("Erro ao buscar permissões:", error);
  }

  const canAccessProtocol = !!profile?.protocol;



  // Toast de boas-vindas (opcional)
  const WELCOME_TOAST = {
    title: "Bem-vindo!",
    message:
      "Seja bem-vindo ao Hub AVANCE. Selecione um produto para ver os detalhes e acessar.",
    durationMs: 0,
  };
  showToast(WELCOME_TOAST);

  
  // Mostra email no footer (com tooltip ao passar o mouse)
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = email || "";
    userEmailEl.title = email || ""; // balão nativo do navegador no hover
    userEmailEl.style.cursor = "default";
  }



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

  renderHubCards({ canAccessProtocol });
});

// -------------------------
// Renderização dos cards
// -------------------------
function renderHubCards({ canAccessProtocol = false } = {}) {
  const grid = document.getElementById("hub-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const visibleApps = APPS.filter(app => {
    if (app.id === "protocol" && !canAccessProtocol) return false;
    return true;
  });

  visibleApps.forEach((app) => {
    const card = document.createElement("article");
    card.className = "hub-card" + (app.enabled ? "" : " hub-card-disabled");
    card.setAttribute("data-app-id", app.id);

    if (app.enabled) {
      card.addEventListener("click", () => {
        openAppModal(app.id);
      });
    }

    const imgTag = app.image
      ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.title || "Aplicação")}">`
      : "";

    card.innerHTML = `
      ${imgTag}
      <div class="hub-card-content">
        <h2 class="hub-card-title">${escapeHtml(app.title || "")}</h2>
      </div>
    `;

    grid.appendChild(card);
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
// Sidebar (Recolhível no Desktop / Gaveta no Mobile)
// -------------------------
function initMobileSidebar() {
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const desktopBtn = document.getElementById("desktop-toggle-btn");

  // Botão redondo do Desktop
  desktopBtn?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });

  // Botão hambúrguer do Mobile
  mobileBtn?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  // Fecha a sidebar no mobile se clicar fora dela
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 900 && document.body.classList.contains("sidebar-open")) {
      const sidebar = document.querySelector(".sidebar");
      const clickedInsideSidebar = sidebar?.contains(e.target);
      const clickedMobileBtn = mobileBtn?.contains(e.target);

      if (!clickedInsideSidebar && !clickedMobileBtn) {
        document.body.classList.remove("sidebar-open");
      }
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

// -------------------------
// Efeito da Navbar (Scroll e Hover no Topo)
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.top-navbar');
  
  if (!navbar) {
    console.warn("Navbar não encontrada pelo script!");
    return;
  }

  // 1. Efeito ao rolar a página (Scroll)
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 2. Efeito ao encostar o mouse no teto (Hover invisível)
  document.addEventListener('mousemove', (e) => {
    // Se o mouse subir até os primeiros 30 pixels da tela (área invisível de gatilho)
    if (e.clientY <= 30) {
      navbar.classList.add('hover-active');
    } else {
      // Se descer, o JS tira a classe, mas fique tranquilo: 
      // o CSS ":hover" que adicionamos vai segurar a barra aberta 
      // caso o mouse já esteja navegando nela ou no menu "Sair".
      navbar.classList.remove('hover-active');
    }
  });
});

// Inicializa a função
// initNavbarScroll();

// ==========================================================
// ANIMAÇÃO DE PARTÍCULAS (VERSÃO À PROVA DE FALHAS)
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  const heroSection = document.querySelector('.hero-section');
  const heroContent = document.querySelector('.hero-content');
  
  if (!heroSection) {
    console.error("Erro: A classe .hero-section não foi encontrada no HTML.");
    return;
  }

  // 1. Força o CSS pelo JavaScript para garantir as camadas (Z-Index)
  heroSection.style.position = 'relative';
  heroSection.style.overflow = 'hidden';
  if (heroContent) {
    heroContent.style.position = 'relative';
    heroContent.style.zIndex = '10'; // Joga o texto e o botão lá pra frente
  }

  // 2. Cria o Canvas dinamicamente (sem precisar mexer no HTML)
  let canvas = document.getElementById('hero-particles');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'hero-particles';
    
    // Força o estilo do canvas para cobrir o fundo
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1'; // Fica atrás do texto (10) e na frente do fundo (0)
    canvas.style.pointerEvents = 'none'; // Ignora o mouse
    
    // Insere o canvas dentro da seção Hero
    heroSection.insertBefore(canvas, heroSection.firstChild);
  }

  const ctx = canvas.getContext('2d');
  let particlesArray = [];

  // 3. Ajusta o tamanho da tela de pintura
  function setCanvasSize() {
    canvas.width = heroSection.offsetWidth;
    canvas.height = heroSection.offsetHeight;
  }
  setCanvasSize();
  window.addEventListener('resize', setCanvasSize);

  // 4. Criação das Partículas Azuis
  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1.5; // Tamanho visível
      this.speedX = (Math.random() - 0.5) * 1.2; // Velocidade suave
      this.speedY = (Math.random() - 0.5) * 1.2;
      this.opacity = Math.random() * 0.7 + 0.3; // Bem visível
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Faz elas quicarem nas bordas invisíveis
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(87, 197, 234, ${this.opacity})`;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(87, 197, 234, 1)'; // O brilho neon ciano
      ctx.fill();
    }
  }

  // 5. Motor de Inicialização
  function init() {
    particlesArray = [];
    // Calcula a densidade de partículas
    const numberOfParticles = Math.floor((canvas.width * canvas.height) / 7000);
    for (let i = 0; i < numberOfParticles; i++) {
      particlesArray.push(new Particle());
    }
  }

  // 6. Loop de Animação
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
});