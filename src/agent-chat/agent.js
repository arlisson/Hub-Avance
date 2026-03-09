/**
 * agent.js — Chat responsivo + Menus padrão Hub + Gestão de Sessão
 */

document.addEventListener("DOMContentLoaded", async () => {
  // --- Elementos da Interface (CORRIGIDOS PARA O NOVO HTML) ---
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.querySelector(".input-container input"); // Corrigido
  const sendBtn = document.querySelector(".send-btn"); // Corrigido
  const themeToggle = document.getElementById("theme-toggle");
  const newChatBtn = document.querySelector(".new-chat-btn"); // Corrigido
  const userEmailEl = document.getElementById("user-email");

  // Elementos de Navegação (Padrão Hub)
  const menuBtn = document.getElementById("mobile-menu-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const menuLogout = document.getElementById("menu-logout");

  // --- Inicialização de Menus ---
  initSettingsMenu(settingsBtn, settingsMenu);
  initMobileSidebar(menuBtn);

  // Trava de segurança: se faltar algum elemento crucial da interface de chat, para aqui.
  if (!chatMessages || !userInput || !sendBtn || !newChatBtn) {
      console.warn("Elementos do chat não encontrados na tela.");
      return;
  }

  // --- Configurações Iniciais ---
  const cfg = await loadAgentConfig().catch(() => null);
  const LOGIN_URL = cfg?.loginUrl || "/login/login.html";
  const AGENT_PROXY_URL = cfg?.agentProxyUrl || "/api/agent";

  // --- Supabase (Segurança e Sessão) ---
  let sb;
  try {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("getSupabaseClient não encontrado.");
    }
    sb = await window.getSupabaseClient();
  } catch (e) {
    console.error("Erro ao carregar Supabase:", e);
    window.location.href = LOGIN_URL;
    return;
  }

  const { data: s1 } = await sb.auth.getSession();
  if (!s1?.session) {
    window.location.href = LOGIN_URL;
    return;
  }

  const emailUser = s1.session.user?.email || "";
  if (userEmailEl) {
    userEmailEl.textContent = emailUser;
    userEmailEl.title = emailUser; // tooltip (balão) no hover
  }

  // --- Verificação de Status (Luz Online/Offline) ---
  checkAgentApiStatus(sb, emailUser);

  // --- Logout (Integrado ao menu Dropdown) ---
  if (menuLogout) {
    menuLogout.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } finally {
        clearAgentChatSessionStorage();
        window.location.href = LOGIN_URL;
      }
    });
  }

  // --- Estado do Chat (Persistência por aba) ---
  const storageKey = `agente_chat_state:${emailUser}`;
  const chatState = loadState(storageKey);
  if (!chatState.sessionId) chatState.sessionId = newSessionId();
  if (!Array.isArray(chatState.messages)) chatState.messages = [];
  saveState(storageKey, chatState);

  renderHistory(chatMessages, chatState.messages);

  // --- Inicialização do Tema ---
  initTheme(themeToggle);

  // --- Eventos do Chat ---
  sendBtn.addEventListener("click", () => sendMessage());

  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  newChatBtn.addEventListener("click", () => {
    chatState.sessionId = newSessionId();
    chatState.messages = [];
    saveState(storageKey, chatState);
    chatMessages.innerHTML = "";
  });

  // --- Lógica de Envio ---
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(chatMessages, chatState, storageKey, "user", text);
    userInput.value = "";
    userInput.style.height = "auto";

    showLoading(chatMessages);

    try {
      const { data: s2 } = await sb.auth.getSession();
      const token = s2?.session?.access_token;

      if (!token) {
        removeLoading();
        window.location.href = LOGIN_URL;
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const resp = await fetch(AGENT_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatInput: text,
          sessionId: chatState.sessionId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const raw = await resp.text();
      removeLoading();

      if (!resp.ok) {
        appendMessage(chatMessages, chatState, storageKey, "bot", formatBackendError(resp.status, raw));
        return;
      }

      let data;
      try { data = JSON.parse(raw); } catch { data = { output: raw }; }

      appendMessage(chatMessages, chatState, storageKey, "bot", data.output || "Desculpe, não entendi.");
    } catch (err) {
      removeLoading();
      console.error(err);
      const errorMsg = err.name === "AbortError" ? "Tempo limite excedido." : "Erro de conexão.";
      appendMessage(chatMessages, chatState, storageKey, "bot", errorMsg);
    }
  }
});

// ---------------------------------------------------------
// FUNÇÕES DE NAVEGAÇÃO E VISUAL (PADRÃO HUB)
// ---------------------------------------------------------

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

  const savedTheme = localStorage.getItem("theme");
  const isLight = savedTheme === "light";

  document.body.classList.toggle("light-mode", isLight);
  document.body.classList.toggle("dark-mode", !isLight);
  updateThemeIcon(themeToggle);

  themeToggle.addEventListener("click", () => {
    const nowLight = document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode", !nowLight);
    localStorage.setItem("theme", nowLight ? "light" : "dark");
    updateThemeIcon(themeToggle);
  });
}

function updateThemeIcon(btn, isDark) {
  // Pega os elementos do botão de tema
  const icon = btn.querySelector("i");
  const text = btn.querySelector("span");
  
  // Pega a imagem da logo lá no topo da sidebar
  const logo = document.querySelector(".company-logo"); 

  // Atualiza o botão (Ícone e Texto)
  if (icon && text) {
    icon.className = isDark ? "ph ph-sun" : "ph ph-moon";
    text.textContent = isDark ? "Modo claro" : "Modo escuro";
  }

  // Atualiza a Logo da Avance
  if (logo) {
    // ATENÇÃO: Substitua os caminhos abaixo pelos nomes corretos dos seus arquivos!
    if (isDark) {
      // Logo para quando o fundo estiver ESCURO (Geralmente a logo com letras brancas/claras)
      logo.src = "../img/LogoEscuroSemFundo.png"; 
    } else {
      // Logo para quando o fundo estiver CLARO (Geralmente a logo com letras escuras/pretas)
      logo.src = "../img/LogoClaraSemFundo.png"; 
    }
  }
}

// ---------------------------------------------------------
// GESTÃO DE ESTADO E CHAT
// ---------------------------------------------------------

function newSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
}

function loadState(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : { sessionId: null, messages: [] };
  } catch { return { sessionId: null, messages: [] }; }
}

function saveState(key, state) {
  sessionStorage.setItem(key, JSON.stringify(state));
}

function renderHistory(chatMessages, messages) {
  chatMessages.innerHTML = "";
  messages.forEach(msg => appendMessage(chatMessages, null, null, msg.role, msg.text, { persist: false }));
}

function appendMessage(chatMessages, chatState, storageKey, role, text, opts = {}) {
  const persist = opts.persist !== false;
  const messageDiv = document.createElement("div");
  
  messageDiv.className = `message ${role === "user" ? "message-user" : "message-bot"}`;

  const contentHTML = role === "bot"
    ? (window.marked ? marked.parse(text) : `<div class="text-content">${escapeHtml(text)}</div>`)
    : `<div class="text-content">${escapeHtml(text)}</div>`;

  // Removemos a variável do avatarHTML, deixando apenas a bolha de mensagem
  messageDiv.innerHTML = `<div class="message-bubble">${contentHTML}</div>`;
  chatMessages.appendChild(messageDiv);
  
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: "smooth"
  });

  if (persist && chatState && storageKey) {
    chatState.messages.push({ role, text });
    saveState(storageKey, chatState);
  }
}

function showLoading(chatMessages) {
  if (document.getElementById("loading-indicator")) return;
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message message-bot";
  loadingDiv.id = "loading-indicator";
  
  // Removemos a div do message-avatar daqui também
  loadingDiv.innerHTML = `
    <div class="message-bubble typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
}

function removeLoading() {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.remove();
}

// ---------------------------------------------------------
// HELPERS E STATUS
// ---------------------------------------------------------

async function checkAgentApiStatus(sb, email) {
  try {
    // Checa primeiro no banco de dados
    const { data } = await sb.from('profiles').select('chave_api').eq('email', email).single();
    // Checa também se há uma chave salva localmente pelo script de cadastro
    const localKey = localStorage.getItem('gemini_api_key');
    
    window.atualizarStatusAgente(!!(data?.chave_api || localKey));
  } catch {
    window.atualizarStatusAgente(false);
  }
}

window.atualizarStatusAgente = function (isOnline) {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const inputBtn = document.querySelector(".send-btn");
  const inputBox = document.querySelector(".input-container input");

  if (!dot || !text) return;

  dot.className = isOnline ? "status-dot online" : "status-dot offline";
  text.className = isOnline ? "status-text online" : "status-text offline";
  text.textContent = isOnline ? "Online" : "Offline";

  if (inputBtn) inputBtn.disabled = !isOnline;
  if (inputBox) {
    inputBox.disabled = !isOnline;
    inputBox.placeholder = isOnline ? "Digite sua mensagem para a Sofia..." : "IA offline. Conecte sua Chave API na barra lateral.";
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#039;" }[m]));
}

async function loadAgentConfig() {
  const r = await fetch("/api/public-agent-config", { cache: "no-store" });
  return r.json().then(j => j.ok ? j : null);
}

function formatBackendError(status, raw) {
  try {
    const j = JSON.parse(raw);
    return `Erro (${status}): ${j.message || j.error || "Erro desconhecido"}`;
  } catch { return `Erro no servidor (${status}).`; }
}

function clearAgentChatSessionStorage() {
  Object.keys(sessionStorage).filter(k => k.startsWith("agente_chat_state:")).forEach(k => sessionStorage.removeItem(k));
}