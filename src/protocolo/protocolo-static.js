document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const themeToggle = document.getElementById("theme-toggle");
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");

  const form = document.getElementById("protocol-form");
  const resultBox = document.getElementById("result-box");
  const protocolOutput = document.getElementById("protocol-output");
  const messageOutput = document.getElementById("message-output");
  const btnCopyProtocol = document.getElementById("btn-copy-protocol");
  const btnCopyMessage = document.getElementById("btn-copy-message");

  initTheme();
  initMobileMenu();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const protocolo = gerarProtocolo();
    const mensagem = montarMensagem(protocolo);

    if (protocolOutput) protocolOutput.value = protocolo;
    if (messageOutput) messageOutput.value = mensagem;

    if (resultBox) {
      resultBox.hidden = false;
      resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  btnCopyProtocol?.addEventListener("click", async () => {
    const value = protocolOutput?.value || "";
    if (!value) {
      alert("Nenhum protocolo foi gerado ainda.");
      return;
    }

    const ok = await copyToClipboard(value);
    alert(ok ? "Número do protocolo copiado." : "Não foi possível copiar o protocolo.");
  });

  btnCopyMessage?.addEventListener("click", async () => {
    const value = messageOutput?.value || "";
    if (!value) {
      alert("Nenhuma mensagem foi gerada ainda.");
      return;
    }

    const ok = await copyToClipboard(value);
    alert(ok ? "Mensagem copiada." : "Não foi possível copiar a mensagem.");
  });

  function gerarProtocolo() {
    const now = new Date();

    const dd = pad2(now.getDate());
    const mm = pad2(now.getMonth() + 1);
    const yy = String(now.getFullYear()).slice(-2);
    const hh = pad2(now.getHours());
    const mi = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());

    return `${dd}${mm}${yy}${hh}${mi}${ss}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function montarMensagem(protocolo) {
    return [
      "Olá.",
      "",
      `Seu atendimento foi registrado com o protocolo: ${protocolo}.`,
      "Guarde este número para acompanhamento, se necessário.",
      "",
      "Atenciosamente,",
      "Equipe AVANCE",
    ].join("\n");
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.left = "-9999px";
      document.body.appendChild(temp);
      temp.focus();
      temp.select();

      const success = document.execCommand("copy");
      document.body.removeChild(temp);

      return success;
    } catch {
      return false;
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      body.classList.add("dark-mode");
      updateThemeIcon(true);
    } else {
      updateThemeIcon(false);
    }

    themeToggle?.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark-mode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateThemeIcon(isDark);
    });
  }

  function updateThemeIcon(isDark) {
    if (!themeToggle) return;
    themeToggle.innerHTML = isDark
      ? '<i class="ph ph-sun"></i>'
      : '<i class="ph ph-moon"></i>';
  }

  function initMobileMenu() {
    menuToggle?.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
      if (!sidebar || !menuToggle) return;

      const clickedInsideSidebar = sidebar.contains(event.target);
      const clickedMenuButton = menuToggle.contains(event.target);

      if (!clickedInsideSidebar && !clickedMenuButton) {
        sidebar.classList.remove("open");
      }
    });
  }
});