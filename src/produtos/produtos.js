/**
 * produtos.js — Página de Produtos AVANCE Telecom
 *
 * Mantém todos os padrões técnicos do hub:
 * - escapeHtml() anti-injeção em toda saída dinâmica
 * - initParticles() com sprite cache offscreen (evita shadowBlur por frame)
 * - initNavbarEffect() com show-on-scroll + mouse-near-top
 * - initTheme() com localStorage e aria-label correto
 * - prefers-reduced-motion respeitado em animações, partículas e marquee
 * - Tab indicator deslizante com JS para posição exata
 * - IntersectionObserver para animação de entrada dos benefícios
 * - Counter animation para os stats do hero
 */

// ==========================================================
// DADOS — Planos e Benefícios
// ==========================================================

const PLANS = {
  internet: [
    {
      id: 'int-essencial',
      name: 'Essencial',
      descriptor: '100 Mbps',
      descriptorIcon: 'ph-wifi',
      priceMonthly: 89.90,
      priceAnnual: 74.90,
      features: [
        'Wi-Fi incluído',
        'Suporte técnico 24h',
        'Instalação sem custo',
        'Sem fidelidade',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
    {
      id: 'int-plus',
      name: 'Plus',
      descriptor: '300 Mbps',
      descriptorIcon: 'ph-wifi-high',
      priceMonthly: 119.90,
      priceAnnual: 99.90,
      features: [
        'Wi-Fi incluído',
        'Suporte técnico 24h',
        'Instalação sem custo',
        'IP fixo',
        'Sem fidelidade',
      ],
      highlight: true,
      highlightLabel: 'Mais Popular',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
    {
      id: 'int-max',
      name: 'Max',
      descriptor: '500 Mbps',
      descriptorIcon: 'ph-wifi-high',
      priceMonthly: 149.90,
      priceAnnual: 124.90,
      features: [
        'Wi-Fi 6 incluído',
        'Suporte prioritário 24h',
        'Instalação sem custo',
        'IP fixo',
        'Antivírus incluso',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
    {
      id: 'int-ultra',
      name: 'Ultra',
      descriptor: '1 Gbps',
      descriptorIcon: 'ph-rocket-launch',
      priceMonthly: 199.90,
      priceAnnual: 164.90,
      features: [
        'Wi-Fi 6E incluído',
        'Suporte VIP 24h',
        'Instalação sem custo',
        'IP fixo dedicado',
        'Antivírus incluso',
        'Cloud backup 100 GB',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
  ],

  movel: [
    {
      id: 'mov-starter',
      name: 'Starter',
      descriptor: '15 GB',
      descriptorIcon: 'ph-device-mobile',
      priceMonthly: 29.90,
      priceAnnual: 24.90,
      features: [
        'Ligações ilimitadas',
        'SMS ilimitado',
        'WhatsApp grátis',
        'Cobertura 4G',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
    {
      id: 'mov-pro',
      name: 'Pro',
      descriptor: '40 GB',
      descriptorIcon: 'ph-device-mobile',
      priceMonthly: 49.90,
      priceAnnual: 42.90,
      features: [
        'Ligações ilimitadas',
        'SMS ilimitado',
        'Redes sociais grátis',
        'Roaming nacional',
        '4G/5G incluso',
      ],
      highlight: true,
      highlightLabel: 'Mais Popular',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
    {
      id: 'mov-elite',
      name: 'Elite',
      descriptor: '80 GB',
      descriptorIcon: 'ph-star',
      priceMonthly: 79.90,
      priceAnnual: 64.90,
      features: [
        'Ligações ilimitadas',
        'SMS ilimitado',
        'Todos os apps grátis',
        'Roaming nacional',
        '5G incluso',
        'Proteção de dispositivo',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Assinar',
      ctaHref: '#contato',
    },
  ],

  fixa: [
    {
      id: 'fix-basico',
      name: 'Básico',
      descriptor: 'Local ilimitado',
      descriptorIcon: 'ph-phone',
      priceMonthly: 39.90,
      priceAnnual: 32.90,
      features: [
        'DDD local gratuito',
        'Identificador de chamadas',
        'Caixa postal',
        'Sem fidelidade',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Contratar',
      ctaHref: '#contato',
    },
    {
      id: 'fix-business',
      name: 'Business',
      descriptor: 'Nacional ilimitado',
      descriptorIcon: 'ph-buildings',
      priceMonthly: 69.90,
      priceAnnual: 57.90,
      features: [
        'DDD nacional gratuito',
        'Identificador de chamadas',
        'Conferência com 3',
        'Ramal virtual',
        'Sem fidelidade',
      ],
      highlight: true,
      highlightLabel: 'Recomendado',
      cta: 'Contratar',
      ctaHref: '#contato',
    },
    {
      id: 'fix-premium',
      name: 'Premium',
      descriptor: 'Nacional + Internacional',
      descriptorIcon: 'ph-globe-hemisphere-west',
      priceMonthly: 99.90,
      priceAnnual: 82.90,
      features: [
        'DDD nacional gratuito',
        '100 min internacionais',
        'PABX virtual',
        'Ramal virtual',
        'Gravação de chamadas',
      ],
      highlight: false,
      highlightLabel: '',
      cta: 'Contratar',
      ctaHref: '#contato',
    },
  ],
};

const BENEFITS = [
  {
    icon: 'ph-globe-hemisphere-west',
    title: 'Cobertura Nacional',
    desc: 'Rede presente em todo o Brasil, com qualidade de sinal garantida em cada ponto de contato.',
  },
  {
    icon: 'ph-headset',
    title: 'Suporte 24 Horas',
    desc: 'Time técnico especializado disponível a qualquer hora do dia, todos os dias do ano.',
  },
  {
    icon: 'ph-lightning',
    title: 'Instalação em 48h',
    desc: 'Agendamos e instalamos rapidamente após a contratação, sem complicação ou burocracia.',
  },
  {
    icon: 'ph-handshake',
    title: 'Sem Fidelidade',
    desc: 'Planos flexíveis sem amarras. Mude ou cancele quando quiser, sem multas.',
  },
];

// ==========================================================
// ESTADO
// ==========================================================
let currentCategory = 'internet';
let isAnnual = false;

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbarEffect();
  initParticles();
  initTheme(document.getElementById('theme-toggle'));
  initMobileSidebar();

  renderPlanSkeletons();
  renderBenefits();
  initPlanTabs();
  initBillingToggle();
  initStatsCounter();
  initBenefitsObserver();

  // Primeira renderização dos cards
  renderPlanCards(currentCategory, isAnnual);
});

// ==========================================================
// RENDERIZAÇÃO: SKELETONS
// ==========================================================
function renderPlanSkeletons(count = 3) {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'plan-card-skeleton';
    s.style.animationDelay = `${i * 0.08}s`;
    grid.appendChild(s);
  }
}

// ==========================================================
// RENDERIZAÇÃO: CARDS DE PLANO
// ==========================================================
function renderPlanCards(category, annual) {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;

  const plans = PLANS[category] || [];

  // Fade out antes de trocar
  grid.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  grid.style.opacity = '0';
  grid.style.transform = 'translateY(6px)';

  setTimeout(() => {
    grid.innerHTML = '';
    grid.style.transition = '';

    plans.forEach((plan, index) => {
      const price = annual ? plan.priceAnnual : plan.priceMonthly;

      // Formata o preço em reais/centavos
      const [reais, centavos] = price.toFixed(2).replace('.', ',').split(',');

      const card = document.createElement('div');
      card.className = 'plan-card' + (plan.highlight ? ' plan-card-highlight' : '');
      card.style.animationDelay = `${index * 0.09}s`;

      const featuresHtml = plan.features.map(f =>
        `<li class="plan-feature">
           <i class="ph ph-check-circle" aria-hidden="true"></i>
           <span>${escapeHtml(f)}</span>
         </li>`
      ).join('');

      const billingNote = annual
        ? `<p class="plan-billing-note">cobrado anualmente</p>`
        : `<p class="plan-billing-note">&nbsp;</p>`; // Reserva o espaço para não pular layout

      card.innerHTML = `
        ${plan.highlight ? `<div class="plan-highlight-badge">${escapeHtml(plan.highlightLabel)}</div>` : ''}
        <div class="plan-header">
          <div class="plan-descriptor">
            <i class="ph ${escapeHtml(plan.descriptorIcon || 'ph-star')}" aria-hidden="true"></i>
            <span>${escapeHtml(plan.descriptor)}</span>
          </div>
          <h3 class="plan-name">${escapeHtml(plan.name)}</h3>
        </div>
        <div class="plan-price-wrap" aria-label="Preço: R$ ${escapeHtml(reais)},${escapeHtml(centavos)} por mês">
          <span class="plan-price-prefix" aria-hidden="true">R$</span>
          <span class="plan-price-value" aria-hidden="true">${escapeHtml(reais)}</span>
          <span class="plan-price-suffix" aria-hidden="true">,${escapeHtml(centavos)}<br><small>/mês</small></span>
        </div>
        ${billingNote}
        <div class="plan-divider" aria-hidden="true"></div>
        <ul class="plan-features-list" aria-label="Benefícios inclusos no plano ${escapeHtml(plan.name)}">
          ${featuresHtml}
        </ul>
        <a href="${escapeHtml(plan.ctaHref)}" class="plan-cta${plan.highlight ? ' plan-cta-primary' : ''}">
          ${escapeHtml(plan.cta)} <i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      `;

      grid.appendChild(card);
    });

    // Fade in após inserir
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        grid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        grid.style.opacity = '1';
        grid.style.transform = 'translateY(0)';
      });
    });
  }, 220);
}

// ==========================================================
// RENDERIZAÇÃO: BENEFÍCIOS
// ==========================================================
function renderBenefits() {
  const benefitsGrid = document.getElementById('benefits-grid');
  if (!benefitsGrid) return;

  BENEFITS.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'benefit-card';

    card.innerHTML = `
      <div class="benefit-icon-wrap">
        <i class="ph ${escapeHtml(b.icon)}" aria-hidden="true"></i>
      </div>
      <h3 class="benefit-title">${escapeHtml(b.title)}</h3>
      <p class="benefit-desc">${escapeHtml(b.desc)}</p>
    `;

    benefitsGrid.appendChild(card);
  });
}

// ==========================================================
// TABS — com indicador deslizante
// ==========================================================
function initPlanTabs() {
  const tabsContainer = document.getElementById('plan-tabs');
  const indicator = document.getElementById('tab-indicator');
  if (!tabsContainer || !indicator) return;

  const tabs = tabsContainer.querySelectorAll('.plan-tab');

  function moveIndicator(tab) {
    // Calcula posição relativa ao container
    const containerRect = tabsContainer.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    indicator.style.width = tabRect.width + 'px';
    indicator.style.transform = `translateX(${tabRect.left - containerRect.left}px)`;
    indicator.classList.add('ready');
  }

  // Posiciona o indicador na tab ativa imediatamente
  const activeTab = tabsContainer.querySelector('.plan-tab.active');
  if (activeTab) {
    // Usa rAF para garantir que o layout já foi calculado
    requestAnimationFrame(() => moveIndicator(activeTab));
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const category = tab.dataset.category;
      if (category === currentCategory) return;

      // Atualiza estado visual
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      moveIndicator(tab);

      currentCategory = category;
      renderPlanCards(currentCategory, isAnnual);
    });

    // Acessibilidade: teclado
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    });
  });

  // Atualiza indicador no resize (evita que fique desalinhado)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const current = tabsContainer.querySelector('.plan-tab.active');
      if (current) moveIndicator(current);
    }, 100);
  });
}

// ==========================================================
// TOGGLE MENSAL / ANUAL
// ==========================================================
function initBillingToggle() {
  const toggle = document.getElementById('billing-toggle');
  const labelMensal = document.getElementById('label-mensal');
  const labelAnual = document.getElementById('label-anual');

  if (!toggle) return;

  toggle.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggle.setAttribute('aria-pressed', String(isAnnual));
    toggle.setAttribute('aria-label', isAnnual ? 'Alternar para cobrança mensal' : 'Alternar para cobrança anual');

    if (labelMensal) {
      labelMensal.classList.toggle('billing-active', !isAnnual);
    }
    if (labelAnual) {
      labelAnual.classList.toggle('billing-active', isAnnual);
    }

    renderPlanCards(currentCategory, isAnnual);
  });
}

// ==========================================================
// COUNTER ANIMATION — stats do hero
// ==========================================================
function initStatsCounter() {
  // Respeita preferência de movimento reduzido
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const statEls = document.querySelectorAll('.stat-number[data-target]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      animateCounter(entry.target);
    });
  }, { threshold: 0.5 });

  statEls.forEach(el => observer.observe(el));
}

function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const isDecimal = el.dataset.decimal === '1';
  const duration = 1400;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;

    if (isDecimal) {
      // 999 → "99,9%"
      const formatted = (current / 10).toFixed(1).replace('.', ',');
      el.textContent = formatted + suffix;
    } else if (target >= 1000) {
      // 50000 → "+50k"
      el.textContent = '+' + Math.floor(current / 1000) + 'k';
    } else {
      el.textContent = Math.floor(current) + suffix;
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// ==========================================================
// OBSERVER — entrada dos cards de benefício
// ==========================================================
function initBenefitsObserver() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Apenas torna visível sem animação
    document.querySelectorAll('.benefit-card').forEach(c => {
      c.style.opacity = '1';
      c.style.transform = 'none';
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);

      // Stagger por posição no DOM
      const siblings = [...entry.target.parentElement.children];
      const index = siblings.indexOf(entry.target);
      entry.target.style.animationDelay = `${index * 0.1}s`;
      entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.15 });

  // Aguarda renderização via renderBenefits()
  requestAnimationFrame(() => {
    document.querySelectorAll('.benefit-card').forEach(c => observer.observe(c));
  });
}

// ==========================================================
// NAVBAR EFFECT
// ==========================================================
function initNavbarEffect() {
  const navbar = document.querySelector('.top-navbar');
  if (!navbar) return;

  const scrollable = document.querySelector('.main-content');

  // Função que verifica a rolagem, não importa quem esteja rolando
  const handleScroll = () => {
    const scrollY = window.scrollY || (scrollable ? scrollable.scrollTop : 0);

    if (scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  // Adiciona o "espião" de rolagem nos dois lugares para garantir!
  window.addEventListener('scroll', handleScroll, { passive: true });
  if (scrollable) {
    scrollable.addEventListener('scroll', handleScroll, { passive: true });
  }

  // Comportamento do mouse no desktop
  document.addEventListener('mousemove', (e) => {
    if (e.clientY <= 30) {
      navbar.classList.add('hover-active');
    } else {
      navbar.classList.remove('hover-active');
    }
  });
}

// ==========================================================
// MENU MOBILE — idêntico ao hub
// ==========================================================
function initMobileSidebar() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navbarLinks = document.querySelector('.navbar-links');
  if (!mobileBtn || !navbarLinks) return;

  mobileBtn.addEventListener('click', () => {
    navbarLinks.classList.toggle('active');
    const icon = mobileBtn.querySelector('i');
    if (icon) {
      icon.className = navbarLinks.classList.contains('active') ? 'ph ph-x' : 'ph ph-list';
    }
  });

  navbarLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navbarLinks.classList.remove('active');
      const icon = mobileBtn.querySelector('i');
      if (icon) icon.className = 'ph ph-list';
    });
  });
}

// ==========================================================
// TEMA — idêntico ao hub
// ==========================================================
function initTheme(themeToggle) {
  if (!themeToggle) return;

  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.remove('dark-mode');
    updateThemeIcon(themeToggle, false);
  } else {
    document.body.classList.add('dark-mode');
    updateThemeIcon(themeToggle, true);
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(themeToggle, isDark);
  });
}

function updateThemeIcon(btn, isDark) {
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';
  }
  // aria-label descreve a AÇÃO (o que vai acontecer ao clicar), não o estado atual
  btn.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
}

// ==========================================================
// PARTÍCULAS — idêntico ao hub (sprite cache offscreen)
// ==========================================================
function initParticles() {
  // Respeita preferência de movimento reduzido do sistema operacional
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let canvas = document.getElementById('global-particles');

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'global-particles';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-10';
    canvas.style.pointerEvents = 'none';
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d');
  let particlesArray = [];
  let rafId = null;

  // Pré-renderiza a partícula com glow em um canvas offscreen.
  // Evita recalcular ctx.shadowBlur por partícula por frame (operação mais cara do Canvas 2D).
  function createParticleSprite(size) {
    const diameter = Math.ceil((size + 15) * 2);
    const oc = document.createElement('canvas');
    oc.width = diameter;
    oc.height = diameter;
    const octx = oc.getContext('2d');
    const center = diameter / 2;

    octx.shadowBlur = 15;
    octx.shadowColor = 'rgba(87, 197, 234, 1)';
    octx.fillStyle = 'rgba(87, 197, 234, 1)';
    octx.beginPath();
    octx.arc(center, center, size, 0, Math.PI * 2);
    octx.fill();

    return oc;
  }

  // Cache de sprites por tamanho (arredondado a 0.5px para limitar variantes)
  const spriteCache = new Map();

  function getSprite(size) {
    const key = Math.round(size * 2) / 2;
    if (!spriteCache.has(key)) {
      spriteCache.set(key, createParticleSprite(key));
    }
    return spriteCache.get(key);
  }

  function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    spriteCache.clear(); // Limpa cache ao redimensionar
  }

  setCanvasSize();

  let resizeTimer;
  window.addEventListener('resize', () => {
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
      this.sprite = getSprite(this.size);
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }

    draw() {
      // drawImage é muito mais rápido que arc + shadowBlur por frame
      const half = this.sprite.width / 2;
      ctx.globalAlpha = this.opacity;
      ctx.drawImage(this.sprite, this.x - half, this.y - half);
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
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
      particlesArray[i].draw();
    }
    rafId = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!rafId) rafId = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Pausa o loop quando a aba fica inativa — economiza CPU/GPU sem benefício visual
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  });

  init();
  startAnimation();
}

// ==========================================================
// HELPER — anti-injeção (idêntico ao hub)
// ==========================================================
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
