// script.js (Hub) — Supabase

document.addEventListener("DOMContentLoaded", async () => {
  /**
   * Instância do Supabase Client exposta globalmente.
   * Deve ser inicializada previamente em `supabaseClient.js`.
   *
   * @type {import('@supabase/supabase-js').SupabaseClient | undefined}
   */
  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error(
      "Supabase client não encontrado. Verifique supabase-js e supabaseClient.js.",
    );
    return;
  }

  // Guard: exige sessão válida
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData?.session) {
    window.location.href = "./login/login.html";
    return;
  }

  // (Opcional) preencher email/nome
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = sessionData.session.user?.email || "";

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      const userNameEl = document.getElementById("user-name");
      if (userNameEl && profile?.name) userNameEl.textContent = profile.name;
    }
  } catch (e) {
    console.warn("Falha ao carregar profile:", e);
  }

  // Logout (opcional)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "./login/login.html";
    });
  }

  // Tema (dark/light)
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
});

/**
 * Atualiza o ícone e o texto do botão de tema (modo escuro/claro).
 *
 * Requer a seguinte estrutura dentro do botão:
 * - Um elemento `<i>` para o ícone (Phosphor Icons).
 * - Um elemento `<span>` para o texto.
 *
 * @param {HTMLElement|null|undefined} themeToggle - Elemento do botão de toggle.
 * @param {boolean} isDark - `true` para modo escuro, `false` para modo claro.
 * @returns {void}
 */
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