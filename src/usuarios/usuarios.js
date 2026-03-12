document.addEventListener("DOMContentLoaded", async () => {
  const LOGIN_URL = "/login/login.html";
  const HUB_URL = "/hub/hub.html";

  let sb;
  let session;
  let allUsers = [];

  const searchEl = document.getElementById("search");
  const errorBox = document.getElementById("errorBox");

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
    window.__USER_ACCESS_TOKEN__ = session.access_token;
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
    alert("Não foi possível validar sua permissão de acesso.");
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

  const menuBackHub = document.getElementById("menu-back-hub");
  if (menuBackHub) {
    menuBackHub.addEventListener("click", () => {
      window.location.href = HUB_URL;
    });
  }

  const menuLogout = document.getElementById("menu-logout");
  if (menuLogout) {
    menuLogout.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } finally {
        window.location.href = LOGIN_URL;
      }
    });
  }

  function applyFilterAndRender() {
    const term = (searchEl?.value || "").trim().toLowerCase();

    const filtered = allUsers.filter((u) => {
      return (
        String(u.name || "").toLowerCase().includes(term) ||
        String(u.email || "").toLowerCase().includes(term) ||
        String(u.cpf || "").toLowerCase().includes(term) ||
        String(u.whatsapp || "").toLowerCase().includes(term)
      );
    });

    renderUsers(filtered);
  }

  async function loadUsers(token) {
    try {
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
      }

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
      applyFilterAndRender();
    } catch (e) {
      if (errorBox) {
        errorBox.textContent = e?.message || "Erro ao carregar usuários.";
        errorBox.hidden = false;
      }
    }
  }

  searchEl?.addEventListener("input", () => {
    applyFilterAndRender();
  });

  await loadUsers(session.access_token);
});

const APP_USAGE_META = {
  agent: {
    label: "Agente de IA",
    metrics: [
      { key: "access", label: "Acessos" },
      { key: "download", label: "Downloads" },
    ],
  },
  desktop: {
    label: "Preenche Fácil",
    metrics: [
      { key: "access", label: "Acessos" },
      { key: "download", label: "Downloads" },
    ],
  },
  protocol_static: {
    label: "Gerador de Protocolo Estático",
    metrics: [
      { key: "access", label: "Acessos" },
      { key: "download", label: "Downloads" },
    ],
  },
  protocol: {
    label: "Gerador de Protocolo",
    metrics: [
      { key: "access", label: "Acessos" },
      { key: "download", label: "Downloads" },
    ],
  },
  protocol_agendor: {
    label: "Gerador de Protocolo Agendor",
    metrics: [
      { key: "access", label: "Acessos" },
      { key: "download", label: "Downloads" },
    ],
  },
};

function renderUsers(users) {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!users.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="6" style="text-align:center; color: var(--muted); padding: 24px;">
        Nenhum usuário encontrado.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  users.forEach((u) => {
    const summaryRow = document.createElement("tr");
    summaryRow.className = "user-summary-row";
    summaryRow.setAttribute("data-user-id", u.id);

    summaryRow.innerHTML = `
      <td>${escapeHtml(u.name || "")}</td>
      <td>${escapeHtml(u.email || "")}</td>
      <td>${escapeHtml(u.cpf || "")}</td>
      <td>${escapeHtml(u.whatsapp || "")}</td>
      <td>
        <span class="badge ${u.protocol ? "success" : "muted"}">
          ${u.protocol ? "Sim" : "Não"}
        </span>
      </td>
      <td>
        <span class="badge ${u.cliente_avance ? "success" : "muted"}">
          ${u.cliente_avance ? "Sim" : "Não"}
        </span>
      </td>
    `;

    const detailsRow = document.createElement("tr");
    detailsRow.className = "user-details-row";
    detailsRow.hidden = true;

    detailsRow.innerHTML = `
      <td colspan="6">
        <div class="user-expanded-box">
          <div class="expand-section-title">Dados do cliente</div>

          <div class="user-card-grid">
            <div class="field">
              <label>Nome</label>
              <input class="input-dark-lite edit-name" value="${escapeAttr(u.name || "")}" />
            </div>

            <div class="field">
              <label>E-mail</label>
              <input class="input-dark-lite edit-email" value="${escapeAttr(u.email || "")}" />
            </div>

            <div class="field">
              <label>CPF</label>
              <input class="input-dark-lite edit-cpf" value="${escapeAttr(u.cpf || "")}" />
            </div>

            <div class="field">
              <label>WhatsApp</label>
              <input class="input-dark-lite edit-whatsapp" value="${escapeAttr(u.whatsapp || "")}" />
            </div>

            <div class="field">
              <label>Tipo de contrato</label>
              <input class="input-dark-lite edit-contract-type" value="${escapeAttr(u.contract_type || "")}" />
            </div>

            <div class="field">
              <label>Operadora</label>
              <input class="input-dark-lite edit-operator" value="${escapeAttr(u.operator || "")}" />
            </div>

            <div class="field">
              <label>Linhas ativas</label>
              <input class="input-dark-lite edit-active-lines" type="number" value="${Number.isFinite(u.active_lines) ? u.active_lines : ""}" />
            </div>

            <div class="field">
              <label>Mobile Service</label>
              <input class="input-dark-lite" value="${u.has_mobile_service ? "Sim" : "Não"}" readonly />
            </div>
          </div>

          <div class="expand-section-title" style="margin-top: 18px;">Permissões</div>

          <div class="field">
            <div class="inline-checks">
              <label>
                <input type="checkbox" class="edit-protocol" ${u.protocol ? "checked" : ""}>
                Protocol
              </label>

              <label>
                <input type="checkbox" class="edit-cliente-avance" ${u.cliente_avance ? "checked" : ""}>
                Cliente Avance
              </label>
            </div>
          </div>

          <div class="expand-section-title" style="margin-top: 18px;">Uso dos aplicativos</div>
          ${renderAppUsageBlock(u.app_usage)}

          <div class="actions">
            <button class="btn-primary btn-save-user" type="button">Salvar alterações</button>
          </div>
        </div>
      </td>
    `;

    summaryRow.addEventListener("click", (e) => {
      const clickedFormElement = e.target.closest("button, input, textarea, select, label");
      if (clickedFormElement) return;

      detailsRow.hidden = !detailsRow.hidden;
      summaryRow.classList.toggle("expanded", !detailsRow.hidden);
    });

    const btnSave = detailsRow.querySelector(".btn-save-user");
    const protocolEl = detailsRow.querySelector(".edit-protocol");
    const clienteEl = detailsRow.querySelector(".edit-cliente-avance");
    const nameEl = detailsRow.querySelector(".edit-name");
    const emailEl = detailsRow.querySelector(".edit-email");
    const cpfEl = detailsRow.querySelector(".edit-cpf");
    const whatsappEl = detailsRow.querySelector(".edit-whatsapp");
    const contractTypeEl = detailsRow.querySelector(".edit-contract-type");
    const operatorEl = detailsRow.querySelector(".edit-operator");
    const activeLinesEl = detailsRow.querySelector(".edit-active-lines");

    btnSave?.addEventListener("click", async () => {
      btnSave.disabled = true;

      try {
        const resp = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.__USER_ACCESS_TOKEN__ || ""}`,
          },
          body: JSON.stringify({
            id: u.id,
            name: (nameEl?.value || "").trim(),
            email: (emailEl?.value || "").trim(),
            cpf: (cpfEl?.value || "").trim(),
            whatsapp: (whatsappEl?.value || "").trim(),
            contract_type: (contractTypeEl?.value || "").trim(),
            operator: (operatorEl?.value || "").trim(),
            active_lines: activeLinesEl?.value === "" ? null : Number(activeLinesEl.value),
            protocol: !!protocolEl?.checked,
            cliente_avance: !!clienteEl?.checked,
          }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data?.error || "Falha ao salvar.");
        }

        u.name = (nameEl?.value || "").trim();
        u.email = (emailEl?.value || "").trim();
        u.cpf = (cpfEl?.value || "").trim();
        u.whatsapp = (whatsappEl?.value || "").trim();
        u.contract_type = (contractTypeEl?.value || "").trim();
        u.operator = (operatorEl?.value || "").trim();
        u.active_lines = activeLinesEl?.value === "" ? null : Number(activeLinesEl.value);
        u.protocol = !!protocolEl?.checked;
        u.cliente_avance = !!clienteEl?.checked;

        renderUsers(users);
      } catch (e) {
        alert(e?.message || "Erro ao salvar usuário.");
      } finally {
        btnSave.disabled = false;
      }
    });

    tbody.appendChild(summaryRow);
    tbody.appendChild(detailsRow);
  });
}

function renderAppUsageBlock(appUsage) {
  const usage = appUsage && typeof appUsage === "object" ? appUsage : {};
  const knownKeys = Object.keys(APP_USAGE_META);
  const unknownKeys = Object.keys(usage).filter((key) => !knownKeys.includes(key));
  const orderedKeys = [...knownKeys.filter((key) => usage[key]), ...unknownKeys];

  if (!orderedKeys.length) {
    return `
      <div class="app-usage-box">
        <div class="hint">Nenhum uso registrado.</div>
      </div>
    `;
  }

  const rows = orderedKeys.map((appKey) => {
    const meta = APP_USAGE_META[appKey] || {
      label: appKey,
      metrics: [
        { key: "access", label: "Acessos" },
        { key: "download", label: "Downloads" },
      ],
    };

    const appData = usage[appKey] || {};

    const metricsHtml = meta.metrics
      .map((metric) => {
        const value = Number(appData?.[metric.key] || 0);
        return `
          <div class="usage-metric">
            <span class="usage-metric-label">${escapeHtml(metric.label)}</span>
            <span class="usage-metric-value">${value}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="usage-product-row">
        <div class="usage-product-name">${escapeHtml(meta.label)}</div>
        <div class="usage-metrics-grid">
          ${metricsHtml}
        </div>
      </div>
    `;
  });

  return `
    <div class="app-usage-box">
      ${rows.join("")}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function initSettingsMenu(btn, menu) {
  if (!btn || !menu) return;

  const close = () => {
    menu.hidden = true;
  };

  const open = () => {
    menu.hidden = false;
  };

  const toggle = () => {
    if (menu.hidden) open();
    else close();
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener("click", (e) => {
    const userbar = document.getElementById("sidebar-userbar");
    if (!userbar?.contains(e.target)) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
    }
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