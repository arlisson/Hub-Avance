document.addEventListener("DOMContentLoaded", async () => {
  const LOGIN_URL = "/login/login.html";
  const HUB_URL = "/hub/hub.html";

  let sb;
  let session;
  let allUsers = [];

  try {
    sb = await window.getSupabaseClient();
  } catch {
    window.location.href = LOGIN_URL;
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();

    if (sessionError || !sessionData?.session) {
      window.location.href = LOGIN_URL;
      return;
    }

    session = sessionData.session;
  } catch {
    window.location.href = LOGIN_URL;
    return;
  }

  const user = session.user;
  const email = user?.email || "";

  try {
    const { data: profile, error } = await sb
      .from("profiles")
      .select("protocol")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    if (!profile?.protocol) {
      alert("Você não tem permissão para acessar esta tela.");
      window.location.href = HUB_URL;
      return;
    }
  } catch (err) {
    console.error("Erro ao validar acesso:", err);
    window.location.href = HUB_URL;
    return;
  }

  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = email;
    userEmailEl.title = email;
  }

  initSettingsMenu(
    document.getElementById("settings-btn"),
    document.getElementById("settings-menu")
  );
  initMobileSidebar(document.getElementById("mobile-menu-btn"));
  initTheme(document.getElementById("theme-toggle"));

  document.getElementById("menu-back-hub")?.addEventListener("click", () => {
    window.location.href = HUB_URL;
  });

  document.getElementById("menu-logout")?.addEventListener("click", async () => {
    try {
      await sb.auth.signOut();
    } finally {
      window.location.href = LOGIN_URL;
    }
  });

  await loadUsers(session.access_token);

  document.getElementById("search")?.addEventListener("input", (e) => {
    const term = (e.target.value || "").trim().toLowerCase();

    const filtered = allUsers.filter((u) => {
      return (
        (u.name || "").toLowerCase().includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.cpf || "").toLowerCase().includes(term)
      );
    });

    renderUsers(filtered);
  });
});

async function loadUsers(token) {
  const errorBox = document.getElementById("errorBox");

  try {
    const resp = await fetch("/api/admin/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.error || "Falha ao carregar usuários.");
    }

    allUsers = Array.isArray(data?.users) ? data.users : [];
    renderUsers(allUsers);
  } catch (e) {
    if (errorBox) {
      errorBox.textContent = e.message || "Erro ao carregar usuários.";
      errorBox.hidden = false;
    }
  }
}

function renderUsers(users) {
  const container = document.getElementById("users-container");
  if (!container) return;

  container.innerHTML = "";

  if (!users.length) {
    container.innerHTML = `<div class="result-row"><span class="k">Nenhum usuário encontrado.</span></div>`;
    return;
  }

  users.forEach((u) => {
    const card = document.createElement("div");
    card.className = "result";
    card.style.marginBottom = "16px";
    card.hidden = false;

    card.innerHTML = `
      <div class="result-row"><span class="k">Nome</span><span class="v">${escapeHtml(u.name || "")}</span></div>
      <div class="result-row"><span class="k">E-mail</span><span class="v">${escapeHtml(u.email || "")}</span></div>
      <div class="result-row"><span class="k">CPF</span><span class="v">${escapeHtml(u.cpf || "")}</span></div>
      <div class="result-row"><span class="k">WhatsApp</span><span class="v">${escapeHtml(u.whatsapp || "")}</span></div>
      <div class="result-row"><span class="k">Protocol</span><span class="v">${u.protocol ? "Sim" : "Não"}</span></div>
      <div class="result-row"><span class="k">Cliente Avance</span><span class="v">${u.cliente_avance ? "Sim" : "Não"}</span></div>

      <div class="field" style="margin-top:12px;">
        <label>Permissões</label>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <label><input type="checkbox" class="edit-protocol" ${u.protocol ? "checked" : ""}> Protocol</label>
          <label><input type="checkbox" class="edit-cliente-avance" ${u.cliente_avance ? "checked" : ""}> Cliente Avance</label>
        </div>
      </div>

      <div class="actions" style="margin-top:12px;">
        <button class="btn-primary btn-save-user" type="button">Salvar</button>
      </div>
    `;

    const btnSave = card.querySelector(".btn-save-user");
    const protocolEl = card.querySelector(".edit-protocol");
    const clienteEl = card.querySelector(".edit-cliente-avance");

    btnSave?.addEventListener("click", async () => {
      btnSave.disabled = true;

      try {
        const resp = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: u.id,
            protocol: !!protocolEl?.checked,
            cliente_avance: !!clienteEl?.checked,
          }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data?.error || "Falha ao salvar.");
        }

        u.protocol = !!protocolEl?.checked;
        u.cliente_avance = !!clienteEl?.checked;
      } catch (e) {
        alert(e.message || "Erro ao salvar usuário.");
      } finally {
        btnSave.disabled = false;
      }
    });

    container.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initSettingsMenu(btn, menu) {
  if (!btn || !menu) return;

  const close = () => { menu.hidden = true; };
  const open = () => { menu.hidden = false; };
  const toggle = () => { menu.hidden ? open() : close(); };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener("click", (e) => {
    const userbar = document.getElementById("sidebar-userbar");
    if (!userbar?.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function initMobileSidebar(menuBtn) {
  if (!menuBtn) return;

  menuBtn.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("sidebar-open")) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar?.contains(e.target) && !menuBtn.contains(e.target)) {
      document.body.classList.remove("sidebar-open");
    }
  });
}

function initTheme(themeToggle) {
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem("theme");
  const isLight = savedTheme === "light";

  document.body.classList.toggle("light-mode", isLight);
  document.body.classList.remove("dark-mode");
  updateThemeIcon(themeToggle);

  themeToggle.addEventListener("click", () => {
    const nowLight = document.body.classList.toggle("light-mode");
    document.body.classList.remove("dark-mode");
    localStorage.setItem("theme", nowLight ? "light" : "dark");
    updateThemeIcon(themeToggle);
  });
}

function updateThemeIcon(btn) {
  const icon = btn?.querySelector("i");
  const text = btn?.querySelector("span");
  const logo = document.querySelector(".company-logo");

  if (!icon || !text) return;

  const isLight = document.body.classList.contains("light-mode");

  if (isLight) {
    icon.className = "ph ph-moon";
    text.textContent = "Modo escuro";
  } else {
    icon.className = "ph ph-sun";
    text.textContent = "Modo claro";
  }

  if (logo) {
    logo.src = !isLight
      ? "../img/LogoEscuroSemFundo.png"
      : "../img/LogoClaraSemFundo.png";
  }
}