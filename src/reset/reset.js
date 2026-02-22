document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("reset-form");
  const pass = document.getElementById("new-password");
  const btn = document.getElementById("save-btn");
  const toggleBtn = document.getElementById("toggle-new-password");

  if (!form || !pass) return;

  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Cliente Supabase não inicializado.");
    return;
  }

  // 1) Se vier pelo link do e-mail com ?code=..., trocar por sessão
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch (e) {
    alert(e?.message || "Link inválido/expirado. Solicite novamente.");
    return;
  }

  // Toggle senha
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = pass.getAttribute("type") === "password";
      pass.setAttribute("type", isPassword ? "text" : "password");

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.classList.toggle("ph-eye");
        icon.classList.toggle("ph-eye-slash");
      }
    });
  }

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPassword = pass.value?.trim();

    if (!newPassword || newPassword.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      alert("Senha atualizada com sucesso. Faça login novamente.");
      window.location.href = "../login/login.html";
    } catch (err) {
      alert(err?.message || "Falha ao atualizar senha.");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});