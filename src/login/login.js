// login.js — Supabase Auth + confirmação de e-mail + reenviar confirmação + esqueci senha
document.addEventListener("DOMContentLoaded", () => {
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const loginForm = document.getElementById("login-form");
  const toggleBtn = document.getElementById("toggle-password");
  const forgotLink = document.getElementById("forgot-password-link");

  if (!identifierInput || !passwordInput || !loginForm) return;

  // Máscara WhatsApp (mantida)
  identifierInput.addEventListener("input", (e) => {
    let value = e.target.value;
    const isEmail = /[a-zA-Z@]/.test(value);

    if (!isEmail) {
      value = value.replace(/\D/g, "");
      if (value.length > 11) value = value.slice(0, 11);
      if (value.length > 2) value = value.replace(/^(\d{2})(\d)/, "($1) $2");
      if (value.length > 7) value = value.replace(/(\d)(\d{4})$/, "$1-$2");
      e.target.value = value;
    }
  });

  // Toggle senha
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.classList.toggle("ph-eye");
        icon.classList.toggle("ph-eye-slash");
      }
    });
  }

  // Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.querySelector(".login-btn");
    const originalText = btn?.innerText || "Entrar";

    const rawIdentifier = identifierInput.value || "";
    const password = passwordInput.value || "";
    const email = rawIdentifier.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Informe um e-mail válido para entrar.");
      return;
    }
    if (!password) {
      alert("Informe sua senha.");
      return;
    }

    if (btn) {
      btn.innerText = "Entrando...";
      btn.disabled = true;
    }

    try {
      const supabase = window.supabaseClient;
      if (!supabase) throw new Error("Supabase client não carregado.");

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.log("LOGIN ERROR:", error);

        const msg = String(error.message || "").toLowerCase();

        // Caso: e-mail não confirmado
        if (msg.includes("confirm") || msg.includes("verified")) {
          // Opcional: reenviar confirmação
          try {
            await supabase.auth.resend({
              type: "signup",
              email,
              options: {
                emailRedirectTo: `${window.location.origin}/login/login.html`,
              },
            });
            alert("Seu e-mail ainda não foi confirmado. Reenviamos o link de confirmação. Verifique caixa de entrada e spam.");
          } catch {
            alert("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e spam.");
          }
          return;
        }

        // Caso: credenciais inválidas
        if (msg.includes("invalid login") || msg.includes("credentials")) {
          alert("E-mail ou senha inválidos.");
          return;
        }

        alert(error.message || "Falha no login.");
        return;
      }

      window.location.href = "../hub/hub.html";
    } catch (error) {
      alert(`Erro: ${error?.message || "Falha no login."}`);
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  });

  // Esqueci minha senha (se você estiver usando /api/forgot-password)
  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = (identifierInput.value || "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Digite seu e-mail no campo acima para receber o link de redefinição.");
        return;
      }

      try {
        const r = await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const out = await r.json().catch(() => null);

        if (!r.ok || !out?.ok) {
          alert(out?.detail || "Falha ao solicitar redefinição. Tente novamente.");
          return;
        }

        alert("Se esse e-mail existir, enviaremos um link para redefinir a senha.");
      } catch {
        alert("Erro de conexão. Tente novamente.");
      }
    });
  }
});