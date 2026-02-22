// login.js — versão para Supabase (sem n8n, sem localStorage de auth)
// Mantém apenas: verificação de elementos, máscara, toggle de senha e submit.

document.addEventListener("DOMContentLoaded", () => {
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const loginForm = document.getElementById("login-form");
  const toggleBtn = document.getElementById("toggle-password");

  if (!identifierInput || !passwordInput || !loginForm) return;

  // --- MÁSCARA (mantida) ---
  identifierInput.addEventListener("input", (e) => {
    let value = e.target.value;
    const isEmail = /[a-zA-Z@]/.test(value);

    // Para o hub, o login será por e-mail. Ainda assim, a máscara não atrapalha.
    if (!isEmail) {
      value = value.replace(/\D/g, "");
      if (value.length > 11) value = value.slice(0, 11);
      if (value.length > 2) value = value.replace(/^(\d{2})(\d)/, "($1) $2");
      if (value.length > 7) value = value.replace(/(\d)(\d{4})$/, "$1-$2");
      e.target.value = value;
    }
  });

  // --- MOSTRAR SENHA (mantido) ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.classList.replace(
          type === "text" ? "ph-eye" : "ph-eye-slash",
          type === "text" ? "ph-eye-slash" : "ph-eye",
        );
      }
    });
  }

  // --- LOGIN (Supabase) ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.querySelector(".login-btn");
    const originalText = btn?.innerText || "Entrar";

    const rawIdentifier = identifierInput.value || "";
    const password = passwordInput.value || "";

    // No hub, login por e-mail (Supabase Auth)
    const email = rawIdentifier.trim();

    if (!email || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(email)) {
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

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      
      window.location.href = "../hub/hub.html";
    } catch (error) {
      //console.error(error);
      alert(`Erro: ${error?.message || "Falha no login."}`);
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  });
});

const forgotLink = document.getElementById("forgot-password-link");

if (forgotLink) {
  forgotLink.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = (identifierInput.value || "").trim();
    if (!email || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(email)) {
      alert("Digite seu e-mail no campo acima para receber o link de redefinição.");
      return;
    }

    const supabase = window.supabaseClient;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset/reset.html`,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Se esse e-mail existir, enviaremos um link para redefinir a senha.");
  });
}