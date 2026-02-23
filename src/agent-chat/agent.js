// apps/agente-chat/chat.js (completo, atualizado)
// Mudanças principais:
// - Tratamento melhor de erro do /api/agent (mostra status + response no chat)
// - Se /api/agent retornar JSON {ok:false,...} mostra detalhes legíveis
// - Timeout para evitar travar indefinidamente
// - Sempre remove loading em qualquer fluxo

document.addEventListener("DOMContentLoaded", async () => {
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const themeToggle = document.getElementById("theme-toggle");
  const newChatBtn = document.getElementById("new-chat-btn");

  if (!chatMessages || !userInput || !sendBtn || !newChatBtn) return;

  const cfg = await loadAgentConfig().catch(() => null);
  const LOGIN_URL = cfg?.loginUrl || "/login/login.html";
  const AGENT_PROXY_URL = cfg?.agentProxyUrl || "/api/agent";

  // Supabase (sessão do Hub)
  let sb;
  try {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("getSupabaseClient não existe. Verifique /supabaseClient.js e supabase-js carregado.");
    }
    sb = await window.getSupabaseClient();
  } catch (e) {
    console.error("Supabase client não carregado:", e);
    window.location.href = LOGIN_URL;
    return;
  }

  const { data: s1 } = await sb.auth.getSession();
  if (!s1?.session) {
    window.location.href = LOGIN_URL;
    return;
  }

  const emailUser = s1.session.user?.email || "";
  if (!emailUser) {
    window.location.href = LOGIN_URL;
    return;
  }

  // Estado por sessão (aba)
  const storageKey = `agente_chat_state:${emailUser}`;
  const chatState = loadState(storageKey);
  if (!chatState.sessionId) chatState.sessionId = newSessionId();
  if (!Array.isArray(chatState.messages)) chatState.messages = [];
  saveState(storageKey, chatState);

  renderHistory(chatMessages, chatState.messages);

  // Tema
  initTheme(themeToggle);

  // Eventos
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
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      let resp;
      try {
        resp = await fetch(AGENT_PROXY_URL, {
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
      } finally {
        clearTimeout(timeoutId);
      }

      const raw = await resp.text();
      removeLoading();

      if (!resp.ok) {
        // tenta extrair JSON de erro do backend
        const friendly = formatBackendError(resp.status, raw);
        appendMessage(chatMessages, chatState, storageKey, "bot", friendly);
        return;
      }

      if (!raw) throw new Error("Resposta vazia");

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { output: raw };
      }

      // Se o backend devolver {ok:false,...} mesmo com 200, trata
      if (data && data.ok === false) {
        appendMessage(chatMessages, chatState, storageKey, "bot", formatAgentApiJsonError(data));
        return;
      }

      appendMessage(chatMessages, chatState, storageKey, "bot", data.output || "Desculpe, não entendi.");
    } catch (err) {
      console.error(err);
      removeLoading();

      if (err?.name === "AbortError") {
        appendMessage(
          chatMessages,
          chatState,
          storageKey,
          "bot",
          "Tempo limite ao contatar o servidor. Tente novamente.",
        );
        return;
      }

      appendMessage(
        chatMessages,
        chatState,
        storageKey,
        "bot",
        "Erro de conexão com o servidor. Tente novamente.",
      );
    }
  }
});

// -------- config --------
async function loadAgentConfig() {
  const r = await fetch("/api/public-agent-config", { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || !j?.ok) throw new Error("missing_agent_config");
  return j;
}

// -------- state --------
function newSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
}

function loadState(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : { sessionId: null, messages: [] };
  } catch {
    return { sessionId: null, messages: [] };
  }
}

function saveState(key, state) {
  sessionStorage.setItem(key, JSON.stringify(state));
}

// -------- UI --------
function renderHistory(chatMessages, messages) {
  chatMessages.innerHTML = "";
  for (const msg of messages) {
    appendMessage(chatMessages, { messages }, null, msg.role, msg.text, { persist: false });
  }
}

function appendMessage(chatMessages, chatState, storageKey, role, text, opts = {}) {
  const persist = opts.persist !== false;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  let avatarHTML = "";
  if (role === "bot") {
    avatarHTML = `<div class="message-avatar"><span>AI</span></div>`;
  }

  const contentHTML =
    role === "bot"
      ? (typeof marked !== "undefined" && marked?.parse
          ? marked.parse(text)
          : `<pre>${escapeHtml(text)}</pre>`)
      : escapeHtml(text);

  messageDiv.innerHTML = `
    ${avatarHTML}
    <div class="message-bubble">${contentHTML}</div>
  `;

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

// -------- theme --------
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

// -------- error helpers --------
function formatBackendError(status, raw) {
  const base = `Erro no servidor (${status}).`;

  if (!raw) return `${base} Resposta vazia.`;

  // tenta JSON
  try {
    const j = JSON.parse(raw);
    return formatAgentApiJsonError(j, status);
  } catch {
    // texto puro (limita tamanho)
    const t = raw.length > 600 ? raw.slice(0, 600) + "…" : raw;
    return `${base}\n\nDetalhes:\n${t}`;
  }
}

function formatAgentApiJsonError(j, statusOverride) {
  if (!j || typeof j !== "object") return "Erro no servidor.";

  const status = statusOverride ? ` (${statusOverride})` : "";
  const code = j.error ? `Código: ${j.error}` : "Erro no servidor.";
  const msg = j.message ? `\nMensagem: ${j.message}` : "";
  const details = j.details ? `\nDetalhes: ${String(j.details)}` : "";

  // missing env (bem comum)
  if (j.error === "missing_env" && j.missing && typeof j.missing === "object") {
    const missingKeys = Object.entries(j.missing)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    const m = missingKeys.length ? `\nFaltando ENV: ${missingKeys.join(", ")}` : "";
    return `${code}${status}${m}${msg}${details}`;
  }

  return `${code}${status}${msg}${details}`;
}

// -------- misc --------
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