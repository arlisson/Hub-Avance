document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-form");
  const pass = document.getElementById("new-password");
  const btn = document.getElementById("save-btn");

  if (!form || !pass) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let supabase;
    try {
      supabase = await window.getSupabaseClient();
    } catch (err) {
      alert(err?.message || "Cliente Supabase não inicializado.");
      return;
    }
    const newPassword = pass.value?.trim();

    if (!newPassword || newPassword.length < 6) {
      alert("A senha deve ter pelo menos 8 caracteres.");
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

  const toggleBtn = document.getElementById("toggle-new-password");

  if (toggleBtn && pass) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = pass.type === "password";
      pass.type = isPassword ? "text" : "password";

      toggleBtn.innerHTML = isPassword
        ? '<i class="ph ph-eye-slash"></i>'
        : '<i class="ph ph-eye"></i>';
    });
  }
});