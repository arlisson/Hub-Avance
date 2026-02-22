// hub.js — guarda de sessão + tema + logout
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error("Supabase client não carregado.");
    return;
  }

  // Guard (se não tiver sessão, volta para login)
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = "../login/login.html";
    return;
  }

  // Mostra email no sidebar
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = sessionData.session.user.email || "";

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "../login/login.html";
    });
  }

  // Tema (reaproveitando seu padrão)
  const themeToggle = document.getElementById("theme-toggle");
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    updateThemeIcon(themeToggle, true);
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateThemeIcon(themeToggle, isDark);
    });
  }

  // (Opcional) Tracking simples: apenas loga por enquanto.
  // Se quiser métricas, você cria uma rota /api/track (Vercel) e faz fetch nela.
  document.querySelectorAll("[data-track]").forEach((el) => {
    el.addEventListener("click", () => {
      const evt = el.getAttribute("data-track");
      console.log("track:", evt);
    });
  });
});

function updateThemeIcon(themeToggle, isDark) {
  if (!themeToggle) return;
  const icon = themeToggle.querySelector("i");
  const text = themeToggle.querySelector("span");
  if (!icon || !text) return;

  if (isDark) {
    icon.classList.replace("ph-moon", "ph-sun");
    text.textContent = "Modo claro";
  } else {
    icon.classList.replace("ph-sun", "ph-moon");
    text.textContent = "Modo escuro";
  }
}