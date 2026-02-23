// --- CONFIGURAÇÃO ---
const N8N_WEBHOOK_URL =
  "https://primary-production-335ec.up.railway.app/webhook-test/agente-avance-v2";

// Ajuste conforme o caminho do login no seu Hub
const LOGIN_URL = "../login/login.html";

// --- ELEMENTOS DO DOM ---
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const themeToggle = document.getElementById("theme-toggle");
const newChatBtn = document.getElementById("new-chat-btn");

// --- UTIL ---
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return m;
    }
  });
}

function safeMarkdownToHtml(text) {
  // Se você tiver DOMPurify carregado, use para sanitizar:
  // return DOMPurify.sanitize(marked.parse(text));
  if (typeof marked !== "undefined" && marked?.parse) return marked.parse(text);
  // fallback simples se marked não existir
  return `<pre>${escapeHtml(text)}</pre>`;
}

// --- AUTENTICAÇÃO (HUB) ---
// Prioridade: sessão do Supabase do Hub (window.supabase). Fallback: localStorage.userEmail (se já existir).
async function getHubEmailOrRedirect() {
  try {
    if (window.supabase?.auth?.getSession) {
      const { data, error } = await window.supabase.auth.getSession();
      if (error) throw error;

      const session = data?.session;
      const email = session?.user?.email;

      if (!email) {
        window.location.href = LOGIN_URL;
        return null;
      }
      return email;
    }
  } catch (e) {
    console.warn("Falha ao ler sessão do Hub (Supabase). Usando fallback.", e);
  }

  // Fallback (mantém compatibilidade com seu fluxo atual)
  const emailUser = localStorage.getItem("userEmail");
  if (!emailUser) {
    window.location.href = LOGIN_URL;
    return null;
  }
  return emailUser;
}

// --- ESTADO DA SESSÃO (somente durante a sessão ativa da aba) ---
let emailUser = null;
let sessionId = null;

function stateKey(email) {
  return `agente_chat_state:${email}`;
}

function newSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
}

function loadState(email) {
  try {
    const raw = sessionStorage.getItem(stateKey(email));
    if (!raw) return { sessionId: newSessionId(), messages: [] };
    const parsed = JSON.parse(raw);
    return {
      sessionId: parsed?.sessionId || newSessionId(),
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return { sessionId: newSessionId(), messages: [] };
  }
}

function saveState(email, state) {
  sessionStorage.setItem(stateKey(email), JSON.stringify(state));
}

let chatState = { sessionId: null, messages: [] };

// --- TEMA (DARK/LIGHT) ---
function updateThemeIcon(isDark) {
  const icon = themeToggle?.querySelector("i");
  const text = themeToggle?.querySelector("span");
  if (!icon || !text) return;

  if (isDark) {
    icon.classList.replace("ph-moon", "ph-sun");
    text.textContent = "Modo claro";
  } else {
    icon.classList.replace("ph-sun", "ph-moon");
    text.textContent = "Modo escuro";
  }
}

function initTheme() {
  const isDark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  updateThemeIcon(isDark);

  themeToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const nowDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", nowDark ? "dark" : "light");
    updateThemeIcon(nowDark);
  });
}

// --- LÓGICA DO CHAT ---
function appendMessage(role, text, { persist = true } = {}) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  let avatarHTML = "";
  if (role === "bot") {
    avatarHTML = `
      <div class="message-avatar">
        <span>AI</span>
      </div>
    `;
  }

  const contentHTML =
    role === "bot" ? safeMarkdownToHtml(text) : escapeHtml(text);

  messageDiv.innerHTML = `
    ${avatarHTML}
    <div class="message-bubble">
      ${contentHTML}
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (persist && emailUser) {
    chatState.messages.push({ role, text });
    saveState(emailUser, chatState);
  }
}

function renderHistory() {
  chatMessages.innerHTML = "";
  for (const msg of chatState.messages) {
    appendMessage(msg.role, msg.text, { persist: false });
  }
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message bot";
  loadingDiv.id = "loading-indicator";
  loadingDiv.innerHTML = `
    <div class="message-avatar"><span>AI</span></div>
    <div class="message-bubble">Digitando...</div>
  `;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoading() {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.remove();
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || !emailUser) return;

  appendMessage("user", text);
  userInput.value = "";
  userInput.style.height = "auto";

  showLoading();

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: text,
        sessionId: chatState.sessionId,
        email: emailUser,
      }),
    });

    const rawText = await response.text();
    removeLoading();

    if (!rawText) throw new Error("Resposta vazia do servidor.");

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Se o n8n devolver texto puro, trate como output direto
      data = { output: rawText };
    }

    appendMessage("bot", data.output || "Desculpe, não entendi.");
  } catch (error) {
    removeLoading();
    console.error("Erro:", error);
    appendMessage("bot", "Erro de conexão com o servidor. Tente novamente.");
  }
}

// --- EVENT LISTENERS ---
function initEvents() {
  sendBtn?.addEventListener("click", sendMessage);

  userInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  newChatBtn?.addEventListener("click", () => {
    if (!emailUser) return;

    chatState = { sessionId: newSessionId(), messages: [] };
    saveState(emailUser, chatState);
    renderHistory();
  });
}

// --- BOOTSTRAP ---
(async function init() {
  initTheme();

  emailUser = await getHubEmailOrRedirect();
  if (!emailUser) return;

  chatState = loadState(emailUser);
  sessionId = chatState.sessionId; // mantido por compatibilidade, se você usar em outro lugar

  renderHistory();
  initEvents();
})();