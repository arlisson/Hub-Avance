// ── State ──────────────────────────────────────────────────────────────────
let supabaseClient  = null;
let currentSession  = null;
let currentView     = "pendentes"; // "pendentes" | "atendidos"

// Paginação — pendentes
const PAGE_SIZE = 25;
let currentPagePend  = 1;
let totalPend        = 0;
let searchElPend     = null;
let filterServicoEl  = null;
let errorBoxPend     = null;
let searchDebounceP  = null;

// Paginação — atendidos
let currentPageAtend = 1;
let totalAtend       = 0;
let searchElAtend    = null;
let filterServicoAtEl = null;
let errorBoxAtend    = null;
let searchDebounceA  = null;

// ── Helpers de loading ─────────────────────────────────────────────────────
function showLoading(title, message) {
  window.AppLoading?.show?.({ title, message });
}
function hideLoading() {
  window.AppLoading?.hide?.();
}
async function withLoading(title, message, task) {
  showLoading(title, message);
  try { return await task(); } finally { hideLoading(); }
}

// ── Query params ───────────────────────────────────────────────────────────
function buildLeadsParams(page, limit, search, servico, atendido) {
  const p = new URLSearchParams();
  p.set("page",     String(page));
  p.set("limit",    String(limit));
  p.set("atendido", String(atendido));
  if (search)  p.set("search",  search);
  if (servico) p.set("servico", servico);
  return p;
}

// ── Badge de filtro ────────────────────────────────────────────────────────
function updateFilterBadge(countElId, clearBtnId, filters) {
  const countEl  = document.getElementById(countElId);
  const clearBtn = document.getElementById(clearBtnId);
  const active   = filters.filter(Boolean).length;

  if (countEl) {
    countEl.textContent = active > 0
      ? `${active} filtro${active > 1 ? "s" : ""} ativo${active > 1 ? "s" : ""}`
      : "";
    countEl.hidden = active === 0;
  }
  if (clearBtn) clearBtn.hidden = active === 0;
}

// ── Result count ───────────────────────────────────────────────────────────
function updateResultCount(elId, total, page, pageSize) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (total === 0) { el.textContent = "Nenhum lead encontrado"; return; }
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  el.textContent = `Exibindo ${from}–${to} de ${total.toLocaleString("pt-BR")} lead${total !== 1 ? "s" : ""}`;
}

// ── Pagination ─────────────────────────────────────────────────────────────
function renderPagination(containerId, total, page, pageSize, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  container.innerHTML = "";
  if (totalPages <= 1) return;

  const wrap = document.createElement("div");
  wrap.className = "pagination";

  const mkBtn = (label, targetPage, disabled, active = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn" + (active ? " active" : "");
    btn.disabled = disabled;
    btn.innerHTML = label;
    if (!disabled) btn.addEventListener("click", () => onPageChange(targetPage));
    return btn;
  };

  wrap.appendChild(mkBtn('<i class="ph ph-caret-left"></i>', page - 1, page === 1));

  const delta = 2;
  const range = [];
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) range.push(i);

  if (range[0] > 1) {
    wrap.appendChild(mkBtn("1", 1, false));
    if (range[0] > 2) { const d = document.createElement("span"); d.className = "page-dots"; d.textContent = "…"; wrap.appendChild(d); }
  }
  range.forEach((p) => wrap.appendChild(mkBtn(String(p), p, false, p === page)));
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) { const d = document.createElement("span"); d.className = "page-dots"; d.textContent = "…"; wrap.appendChild(d); }
    wrap.appendChild(mkBtn(String(totalPages), totalPages, false));
  }

  wrap.appendChild(mkBtn('<i class="ph ph-caret-right"></i>', page + 1, page === totalPages));
  container.appendChild(wrap);
}

// ── Render table ───────────────────────────────────────────────────────────
function renderLeads(leads, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!leads.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center;color:var(--text-secondary);padding:24px;">Nenhum lead encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  leads.forEach((lead) => {
    const summaryRow = document.createElement("tr");
    summaryRow.className = "user-summary-row";

    summaryRow.innerHTML = `
      <td>${escapeHtml(lead.nome || "")}</td>
      <td>${escapeHtml(lead.whatsapp || "")}</td>
      <td>${escapeHtml(lead.cpf || "")}</td>
      <td>${lead.servico ? `<span class="badge-servico">${escapeHtml(lead.servico)}</span>` : `<span style="color:var(--text-secondary);font-size:12px">—</span>`}</td>
      <td>${formatDate(lead.created_at)}</td>
      <td>
        <span class="badge ${lead.atendido ? "success" : "warning"}">
          ${lead.atendido ? "Atendido" : "Pendente"}
        </span>
      </td>
    `;

    const detailsRow = document.createElement("tr");
    detailsRow.className = "user-details-row";
    detailsRow.hidden = true;

    const dadosHtml = buildDadosHtml(lead.dados);

    detailsRow.innerHTML = `
      <td colspan="6">
        <div class="user-expanded-box">
          <div class="expand-section-title">Dados do lead</div>
          <div class="user-card-grid">
            <div class="field">
              <label>Nome</label>
              <input class="input-dark-lite" value="${escapeAttr(lead.nome || "")}" readonly />
            </div>
            <div class="field">
              <label>WhatsApp</label>
              <input class="input-dark-lite" value="${escapeAttr(lead.whatsapp || "")}" readonly />
            </div>
            <div class="field">
              <label>CPF/CNPJ</label>
              <input class="input-dark-lite" value="${escapeAttr(lead.cpf || "")}" readonly />
            </div>
            <div class="field">
              <label>Serviço de interesse</label>
              <input class="input-dark-lite" value="${escapeAttr(lead.servico || "")}" readonly />
            </div>
          </div>

          ${dadosHtml}

          <div class="actions-lead">
            ${lead.atendido
              ? `<button class="btn-desfazer-atendido btn-toggle-atendido" type="button" data-id="${escapeAttr(lead.id)}" data-atendido="true">
                   <i class="ph ph-arrow-u-up-left"></i> Desfazer atendimento
                 </button>`
              : `<button class="btn-atendido btn-toggle-atendido" type="button" data-id="${escapeAttr(lead.id)}" data-atendido="false">
                   <i class="ph ph-check-circle"></i> Marcar como atendido
                 </button>`
            }
          </div>
        </div>
      </td>
    `;

    summaryRow.addEventListener("click", (e) => {
      if (e.target.closest("button, input")) return;
      detailsRow.hidden = !detailsRow.hidden;
      summaryRow.classList.toggle("expanded", !detailsRow.hidden);
    });

    detailsRow.querySelector(".btn-toggle-atendido")?.addEventListener("click", async (e) => {
      const btn        = e.currentTarget;
      const leadId     = btn.dataset.id;
      const wasAtendido = btn.dataset.atendido === "true";
      const newAtendido = !wasAtendido;

      btn.disabled = true;
      try {
        const resp = await fetch("/api/admin/update-lead", {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            Authorization:   `Bearer ${window.__USER_ACCESS_TOKEN__ || ""}`,
          },
          body: JSON.stringify({ id: leadId, atendido: newAtendido }),
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Falha ao atualizar.");

        // Recarrega a view atual
        if (currentView === "pendentes") {
          await loadLeads("pendentes", currentPagePend, false);
        } else {
          await loadLeads("atendidos", currentPageAtend, false);
        }
      } catch (err) {
        alert(err?.message || "Erro ao atualizar o lead.");
        btn.disabled = false;
      }
    });

    tbody.appendChild(summaryRow);
    tbody.appendChild(detailsRow);
  });
}

function buildDadosHtml(dados) {
  if (!dados || typeof dados !== "object" || !Object.keys(dados).length) {
    return `
      <div class="expand-section-title" style="margin-top:18px;">Respostas do formulário</div>
      <p class="dado-empty">Nenhuma resposta registrada.</p>
    `;
  }

  const items = Object.entries(dados).map(([key, value]) => {
    const displayValue = value === null || value === undefined || value === ""
      ? `<span class="dado-empty">Não informado</span>`
      : escapeHtml(String(value));
    return `
      <div class="dado-item">
        <div class="dado-key">${escapeHtml(key)}</div>
        <div class="dado-value">${displayValue}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="expand-section-title" style="margin-top:18px;">Respostas do formulário</div>
    <div class="dados-grid">${items}</div>
  `;
}

// ── Load leads ─────────────────────────────────────────────────────────────
async function loadLeads(view, page = 1, showLoader = true) {
  const isPend    = view === "pendentes";
  const tbodyId   = isPend ? "leads-table-body" : "leads-table-body-atendidos";
  const countId   = isPend ? "filter-result-count" : "filter-result-count-atendidos";
  const paginId   = isPend ? "pagination-controls" : "pagination-controls-atendidos";
  const errBox    = isPend ? errorBoxPend : errorBoxAtend;
  const searchVal = ((isPend ? searchElPend : searchElAtend)?.value || "").trim();
  const servico   = (isPend ? filterServicoEl : filterServicoAtEl)?.value || "";

  const task = async () => {
    setError(errBox, "", true);
    try {
      const params = buildLeadsParams(page, PAGE_SIZE, searchVal, servico, !isPend);
      const resp   = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${window.__USER_ACCESS_TOKEN__ || ""}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Falha ao carregar leads.");

      const leads = Array.isArray(data?.leads) ? data.leads : [];
      const total = Number.isFinite(data?.total) ? data.total : leads.length;

      if (isPend) { currentPagePend = page; totalPend = total; }
      else        { currentPageAtend = page; totalAtend = total; }

      renderLeads(leads, tbodyId);
      updateResultCount(countId, total, page, PAGE_SIZE);
      renderPagination(paginId, total, page, PAGE_SIZE, (p) => loadLeads(view, p, false));
    } catch (err) {
      setError(errBox, err?.message || "Erro ao carregar leads.");
    }
  };

  return showLoader
    ? withLoading("Carregando leads", "Buscando dados...", task)
    : task();
}

// ── Fetch all for Excel export ─────────────────────────────────────────────
async function fetchAllLeads(atendido, search, servico) {
  const limit = 500;
  let page = 1;
  const results = [];
  while (true) {
    const params = buildLeadsParams(page, limit, search, servico, atendido);
    const resp   = await fetch(`/api/admin/leads?${params.toString()}`, {
      headers: { Authorization: `Bearer ${window.__USER_ACCESS_TOKEN__ || ""}` },
    });
    if (!resp.ok) throw new Error("Falha ao buscar leads para exportação.");
    const data  = await resp.json();
    const leads = Array.isArray(data?.leads) ? data.leads : [];
    results.push(...leads);
    if (leads.length < limit) break;
    page++;
  }
  return results;
}

async function exportLeadsToExcel(atendido, label) {
  const btn = document.getElementById(atendido ? "btn-export-excel-atendidos" : "btn-export-excel");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Buscando dados…'; }

  try {
    const isPend  = !atendido;
    const search  = ((isPend ? searchElPend : searchElAtend)?.value || "").trim();
    const servico = (isPend ? filterServicoEl : filterServicoAtEl)?.value || "";
    const leads   = await fetchAllLeads(atendido, search, servico);

    if (!leads.length) { alert("Nenhum lead encontrado com os filtros atuais."); return; }

    const rows = leads.map((l) => ({
      Nome:       l.nome     || "",
      WhatsApp:   l.whatsapp || "",
      "CPF/CNPJ": l.cpf      || "",
      Serviço:    l.servico  || "",
      "Data":     formatDate(l.created_at),
      Atendido:   l.atendido ? "Sim" : "Não",
      ...(l.dados && typeof l.dados === "object"
        ? Object.fromEntries(Object.entries(l.dados).map(([k, v]) => [`Resp: ${k}`, v ?? ""]))
        : {}),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map((key) => ({
      wch: Math.min(Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length)) + 2, 40),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);

    const now   = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    XLSX.writeFile(wb, `leads_avance_${atendido ? "atendidos" : "pendentes"}_${stamp}.xlsx`);
  } catch (err) {
    alert(err?.message || "Erro ao exportar.");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-microsoft-excel-logo"></i> Exportar para Excel'; }
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────
function initNavigation() {
  document.querySelectorAll(".nav-card").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view || "pendentes"));
  });
}

function switchView(view) {
  currentView = view;

  document.querySelectorAll(".nav-card").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });

  const sections = {
    pendentes: document.getElementById("view-pendentes"),
    atendidos: document.getElementById("view-atendidos"),
  };
  const headers = {
    pendentes: document.getElementById("page-header-pendentes"),
    atendidos: document.getElementById("page-header-atendidos"),
  };

  Object.entries(sections).forEach(([key, el]) => { if (el) el.hidden = key !== view; });
  Object.entries(headers).forEach(([key, el]) => { if (el) el.hidden = key !== view; });

  if (document.body.classList.contains("sidebar-open")) {
    document.body.classList.remove("sidebar-open");
  }
}

// ── Single dropdown helper ─────────────────────────────────────────────────
function initSingleDropdown({ btnId, dropdownId, labelId, hiddenEl, onSelect }) {
  const btn      = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  const label    = document.getElementById(labelId);

  btn?.addEventListener("click", () => {
    const isOpen = !dropdown.hidden;
    document.querySelectorAll(".filter-multiselect-dropdown").forEach((d) => { d.hidden = true; });
    document.querySelectorAll(".filter-multiselect-btn.is-open").forEach((b) => b.classList.remove("is-open"));
    if (!isOpen) { dropdown.hidden = false; btn.classList.add("is-open"); }
  });

  dropdown?.querySelectorAll(".filter-single-item").forEach((li) => {
    li.addEventListener("click", () => {
      if (hiddenEl) hiddenEl.value = li.dataset.value;
      if (label) label.textContent = li.textContent;
      dropdown.querySelectorAll(".filter-single-item").forEach((el) => el.classList.remove("is-selected"));
      li.classList.add("is-selected");
      dropdown.hidden = true;
      btn?.classList.remove("is-open");
      onSelect?.();
    });
  });
}

function resetSingleDropdown({ dropdownId, labelId, hiddenEl, defaultLabel }) {
  if (hiddenEl) hiddenEl.value = "";
  const lbl = document.getElementById(labelId);
  if (lbl) lbl.textContent = defaultLabel;
  const dd = document.getElementById(dropdownId);
  if (dd) {
    dd.querySelectorAll(".filter-single-item").forEach((li) => li.classList.remove("is-selected"));
    const first = dd.querySelector(".filter-single-item");
    if (first) first.classList.add("is-selected");
  }
}

// ── Filter toggle ──────────────────────────────────────────────────────────
function initFilterToggle(toggleId, bodyId, caretId) {
  document.getElementById(toggleId)?.addEventListener("click", () => {
    const body  = document.getElementById(bodyId);
    const caret = document.getElementById(caretId);
    if (!body) return;
    const open = body.hidden;
    body.hidden = !open;
    if (caret) caret.className = open ? "ph ph-caret-up filter-caret" : "ph ph-caret-down filter-caret";
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────
function setError(el, message, hidden = false) {
  if (!el) return;
  el.textContent = message || "";
  el.hidden = hidden || !message;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
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
  const close = () => { menu.hidden = true; };
  btn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener("click", (e) => { if (!e.target.closest("#sidebar-userbar")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

function initMobileSidebar(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
}

function initTheme(btn) {
  if (!btn) return;
  const saved = localStorage.getItem("theme");
  if (saved === "light") { document.body.classList.add("light-mode"); btn.querySelector("span").textContent = "Modo escuro"; btn.querySelector("i").className = "ph ph-moon"; }
  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    btn.querySelector("span").textContent = isLight ? "Modo escuro" : "Modo claro";
    btn.querySelector("i").className = isLight ? "ph ph-moon" : "ph ph-sun";
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const LOGIN_URL = "/login/login.html";
  const HUB_URL   = "../paginaUnificada/index.html";

  searchElPend     = document.getElementById("search");
  searchElAtend    = document.getElementById("search-atendidos");
  filterServicoEl  = document.getElementById("filter-servico");
  filterServicoAtEl = document.getElementById("filter-servico-atendidos");
  errorBoxPend     = document.getElementById("errorBox");
  errorBoxAtend    = document.getElementById("errorBoxAtendidos");

  try {
    await withLoading("Carregando leads", "Validando acesso...", async () => {
      // Auth
      try { supabaseClient = await window.getSupabaseClient(); } catch { window.location.href = LOGIN_URL; return; }

      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !sessionData?.session) { window.location.href = LOGIN_URL; return; }

      currentSession = sessionData.session;
      window.__USER_ACCESS_TOKEN__ = currentSession.access_token;

      const user  = currentSession.user;
      const email = user?.email || "";

      // Permission check
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles").select("protocol").eq("id", user.id).single();

      if (profileError || !profile?.protocol) {
        alert("Você não tem permissão para acessar esta tela.");
        window.location.href = HUB_URL;
        return;
      }

      // Email
      const emailEl = document.getElementById("user-email");
      if (emailEl) { emailEl.textContent = email; emailEl.title = email; }

      // UI setup
      initSettingsMenu(document.getElementById("settings-btn"), document.getElementById("settings-menu"));
      initMobileSidebar(document.getElementById("mobile-menu-btn"));
      initTheme(document.getElementById("theme-toggle"));
      initNavigation();

      document.getElementById("menu-back-hub")?.addEventListener("click", () => { window.location.href = HUB_URL; });
      document.getElementById("menu-logout")?.addEventListener("click", async () => {
        try { await supabaseClient.auth.signOut(); } finally { window.location.href = LOGIN_URL; }
      });

      // Close dropdowns on outside click
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".filter-multiselect")) {
          document.querySelectorAll(".filter-multiselect-dropdown").forEach((d) => { d.hidden = true; });
          document.querySelectorAll(".filter-multiselect-btn.is-open").forEach((b) => b.classList.remove("is-open"));
        }
      });

      // Filter toggles
      initFilterToggle("filter-bar-toggle",          "filter-bar-body",          "filter-caret");
      initFilterToggle("filter-bar-toggle-atendidos", "filter-bar-body-atendidos", "filter-caret-atendidos");

      // Search — pendentes
      searchElPend?.addEventListener("input", () => {
        clearTimeout(searchDebounceP);
        searchDebounceP = setTimeout(() => { currentPagePend = 1; loadLeads("pendentes", 1, false); updateBadgePend(); }, 350);
      });

      // Search — atendidos
      searchElAtend?.addEventListener("input", () => {
        clearTimeout(searchDebounceA);
        searchDebounceA = setTimeout(() => { currentPageAtend = 1; loadLeads("atendidos", 1, false); updateBadgeAtend(); }, 350);
      });

      // Servico filter — pendentes
      initSingleDropdown({
        btnId: "filter-servico-btn", dropdownId: "filter-servico-dropdown",
        labelId: "filter-servico-label", hiddenEl: filterServicoEl,
        onSelect: () => { currentPagePend = 1; loadLeads("pendentes", 1, false); updateBadgePend(); },
      });

      // Servico filter — atendidos
      initSingleDropdown({
        btnId: "filter-servico-atendidos-btn", dropdownId: "filter-servico-atendidos-dropdown",
        labelId: "filter-servico-atendidos-label", hiddenEl: filterServicoAtEl,
        onSelect: () => { currentPageAtend = 1; loadLeads("atendidos", 1, false); updateBadgeAtend(); },
      });

      // Clear filters — pendentes
      document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
        resetSingleDropdown({ dropdownId: "filter-servico-dropdown", labelId: "filter-servico-label", hiddenEl: filterServicoEl, defaultLabel: "Todos" });
        if (searchElPend) searchElPend.value = "";
        currentPagePend = 1;
        loadLeads("pendentes", 1, false);
        updateBadgePend();
      });

      // Clear filters — atendidos
      document.getElementById("btn-clear-filters-atendidos")?.addEventListener("click", () => {
        resetSingleDropdown({ dropdownId: "filter-servico-atendidos-dropdown", labelId: "filter-servico-atendidos-label", hiddenEl: filterServicoAtEl, defaultLabel: "Todos" });
        if (searchElAtend) searchElAtend.value = "";
        currentPageAtend = 1;
        loadLeads("atendidos", 1, false);
        updateBadgeAtend();
      });

      // Export
      document.getElementById("btn-export-excel")?.addEventListener("click", () => exportLeadsToExcel(false, "Pendentes"));
      document.getElementById("btn-export-excel-atendidos")?.addEventListener("click", () => exportLeadsToExcel(true, "Atendidos"));

      // Load both views in parallel
      await Promise.all([
        loadLeads("pendentes", 1, false),
        loadLeads("atendidos", 1, false),
      ]);
    });
  } catch (err) {
    console.error(err);
    setError(errorBoxPend, "Erro ao carregar a página.");
  }
});

function updateBadgePend() {
  updateFilterBadge("filter-active-count", "btn-clear-filters", [
    filterServicoEl?.value,
    searchElPend?.value?.trim(),
  ]);
}

function updateBadgeAtend() {
  updateFilterBadge("filter-active-count-atendidos", "btn-clear-filters-atendidos", [
    filterServicoAtEl?.value,
    searchElAtend?.value?.trim(),
  ]);
}
