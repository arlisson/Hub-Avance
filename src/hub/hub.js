/**
 * Initializes the hub page with session guard, theme management, and event listeners.
 * 
 * - Validates user session and redirects to login if not authenticated
 * - Displays user email in sidebar and card elements
 * - Sets up logout functionality
 * - Manages dark/light theme toggle with localStorage persistence
 * - Initializes tracking for elements with data-track attribute
 * - Handles mobile sidebar menu toggle and overlay click handling
 * - Closes sidebar on Escape key press
 * 
 * @async
 * @returns {Promise<void>}
 * 
 * @requires getSupabaseClient - Function to get authenticated Supabase client
 * @requires updateThemeIcon - Function to update theme toggle icon and text
 * 
 * @listens DOMContentLoaded
 * @listens click - On logout button, menu button, and document for sidebar overlay
 * @listens keydown - For Escape key to close sidebar
 */
// hub.js — guarda de sessão + tema + logout
document.addEventListener("DOMContentLoaded", async () => {

  const sb = await getSupabaseClient();
  const { data } = await sb.auth.getSession();

  if (!data?.session) {
    window.location.href = "../login/login.html";
    return;
  }

 

  // Guard (se não tiver sessão, volta para login)
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = "../login/login.html";
    return;
  }

  // Mostra email no sidebar
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = sessionData.session.user.email || "";

  const userEmailCardEl = document.getElementById("user-email-card");
  if (userEmailCardEl) userEmailCardEl.textContent = sessionData.session.user.email || "";

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
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


/**
 * Updates the theme toggle button icon and text based on the current theme mode.
 * 
 * @param {HTMLElement|null} themeToggle - The theme toggle button element containing an icon and text.
 * @param {boolean} isDark - Whether the current theme is dark mode.
 * @returns {void}
 * 
 * @description
 * If isDark is true, replaces the moon icon with a sun icon and sets text to "Modo claro" (Light mode).
 * If isDark is false, replaces the sun icon with a moon icon and sets text to "Modo escuro" (Dark mode).
 * Returns early if themeToggle is null or if the icon/text elements are not found.
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

const menuBtn = document.getElementById("mobile-menu-btn");

menuBtn?.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

/* Fecha ao clicar no overlay */
document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("sidebar-open")) return;

  const sidebar = document.querySelector(".sidebar");
  const clickedInsideSidebar = sidebar?.contains(e.target);
  const clickedMenuBtn = menuBtn?.contains(e.target);

  if (!clickedInsideSidebar && !clickedMenuBtn) {
    document.body.classList.remove("sidebar-open");
  }
});

/* Opcional: fecha com ESC */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("sidebar-open");
});