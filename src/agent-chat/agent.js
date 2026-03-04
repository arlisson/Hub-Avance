/**
 * agent.js — Chat responsivo + Menus padrão Hub + Gestão de Sessão
 */

document.addEventListener("DOMContentLoaded", async () => {
  // --- Elementos da Interface ---
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const themeToggle = document.getElementById("theme-toggle");
  const newChatBtn = document.getElementById("new-chat-btn");
  const userEmailEl = document.getElementById("user-email");

  // Elementos de Navegação (Padrão Hub)
  const menuBtn = document.getElementById("mobile-menu-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const menuLogout = document.getElementById("menu-logout");

  // --- Inicialização de Menus ---
  initSettingsMenu(settingsBtn, settingsMenu);
  initMobileSidebar(menuBtn);

  if (!chatMessages || !userInput || !sendBtn || !newChatBtn) return;

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
  if (userEmailEl) userEmailEl.textContent = emailUser;

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
  messageDiv.className = `message ${role}`;

  let avatarHTML = role === "bot" ? `<div class="message-avatar"><span>AI</span></div>` : "";

  const contentHTML = role === "bot"
    ? (window.marked ? marked.parse(text) : `<pre>${escapeHtml(text)}</pre>`)
    : escapeHtml(text);

  messageDiv.innerHTML = `${avatarHTML}<div class="message-bubble">${contentHTML}</div>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (persist && chatState && storageKey) {
    chatState.messages.push({ role, text });
    saveState(storageKey, chatState);
  }
}

function showLoading(chatMessages) {
  if (document.getElementById("loading-indicator")) return;
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message bot";
  loadingDiv.id = "loading-indicator";
  loadingDiv.innerHTML = `<div class="message-avatar"><span>AI</span></div><div class="message-bubble">Digitando...</div>`;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
    const { data } = await sb.from('profiles').select('chave_api').eq('email', email).single();
    window.atualizarStatusAgente(!!(data && data.chave_api));
  } catch {
    window.atualizarStatusAgente(false);
  }
}

window.atualizarStatusAgente = function (isOnline) {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const inputBtn = document.getElementById("send-btn");
  const inputBox = document.getElementById("user-input");

  if (!dot || !text) return;

  dot.className = isOnline ? "status-dot online" : "status-dot offline";
  text.className = isOnline ? "status-text online" : "status-text offline";
  text.textContent = isOnline ? "Online" : "Offline";

  if (inputBtn) inputBtn.disabled = !isOnline;
  if (inputBox) inputBox.placeholder = isOnline ? "Digite sua mensagem..." : "IA offline. Adicione uma chave API.";
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