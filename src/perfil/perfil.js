const LOGIN_URL = "/login/login.html";
const HUB_URL = "/hub/hub.html";

let CURRENT_PROFILE = null;

document.addEventListener("DOMContentLoaded", async () => {
  let sb;
  let session;

  const form = document.getElementById("perfil-form");
  const errorBox = document.getElementById("errorBox");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const cpfInput = document.getElementById("cpf");
  const whatsappInput = document.getElementById("whatsapp");
  const cepInput = document.getElementById("cep");
  const cidadeInput = document.getElementById("cidade");
  const estadoInput = document.getElementById("estado");
  const hasMobileInput = document.getElementById("has-mobile");
  const contractTypeInput = document.getElementById("contract-type");
  const operatorInput = document.getElementById("operator");
  const activeLinesInput = document.getElementById("active-lines");
  const saveBtn = document.getElementById("save-btn");

  try {
    sb = await window.getSupabaseClient();
  } catch (e) {
    console.error("Supabase client não carregado:", e);
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

  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = email;
    userEmailEl.title = email;
    userEmailEl.style.cursor = "default";
  }

  try {
    const { data: profile, error } = await sb
      .from("profiles")
      .select(`
        id,
        name,
        email,
        cpf,
        whatsapp,
        cep,
        regiao,
        protocol,
        has_mobile_service,
        contract_type,
        operator,
        active_lines
      `)
      .eq("id", user.id)
      .single();

    if (error) throw error;

    CURRENT_PROFILE = profile || null;

    const menuUsers = document.getElementById("menu-users");
    if (menuUsers) {
      const shouldShow = !!profile?.protocol;
      menuUsers.hidden = !shouldShow;
      menuUsers.style.display = shouldShow ? "" : "none";
    }

    fillProfileForm(profile);
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);

    if (errorBox) {
      errorBox.textContent = "Não foi possível carregar seu perfil.";
      errorBox.hidden = false;
    }
    return;
  }

  initSettingsMenu(
    document.getElementById("settings-btn"),
    document.getElementById("settings-menu")
  );
  initTheme(document.getElementById("theme-toggle"));

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

  whatsappInput?.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value;
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    hideError(errorBox);

    const nameValue = (nameInput?.value || "").trim();
    const whatsappValue = (whatsappInput?.value || "").replace(/\D/g, "");

    if (!nameValue) {
      showError(errorBox, "Informe seu nome.");
      return;
    }

    if (!whatsappValue || whatsappValue.length < 10) {
      showError(errorBox, "Informe um WhatsApp válido.");
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <i class="ph ph-spinner-gap spinner"></i>
        <span>Salvando...</span>
      `;
    }

    try {
      const { error } = await sb
        .from("profiles")
        .update({
          name: nameValue,
          whatsapp: whatsappValue,
        })
        .eq("id", user.id);

      if (error) throw error;

      if (CURRENT_PROFILE) {
        CURRENT_PROFILE.name = nameValue;
        CURRENT_PROFILE.whatsapp = whatsappValue;
      }

      alert("Perfil atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      showError(errorBox, "Não foi possível salvar as alterações.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <i class="ph ph-floppy-disk"></i>
          <span>Salvar alterações</span>
        `;
      }
    }
  });

  function fillProfileForm(profile) {
    let regiao = {};

    if (profile?.regiao && typeof profile.regiao === "object") {
      regiao = profile.regiao;
    } else if (typeof profile?.regiao === "string") {
      try {
        regiao = JSON.parse(profile.regiao);
      } catch {
        regiao = {};
      }
    }

    if (nameInput) nameInput.value = profile?.name || "";
    if (emailInput) emailInput.value = profile?.email || email || "";
    if (cpfInput) cpfInput.value = profile?.cpf || "";
    if (whatsappInput) whatsappInput.value = formatWhatsapp(profile?.whatsapp || "");
    if (cepInput) cepInput.value = regiao?.cep || profile?.cep || "";
    if (cidadeInput) cidadeInput.value = regiao?.cidade || "";
    if (estadoInput) estadoInput.value = regiao?.estado || "";
    if (hasMobileInput) hasMobileInput.value = profile?.has_mobile_service ? "Sim" : "Não";
    if (contractTypeInput) contractTypeInput.value = profile?.contract_type || "";
    if (operatorInput) operatorInput.value = profile?.operator || "";
    if (activeLinesInput) {
      activeLinesInput.value =
        Number.isFinite(profile?.active_lines) ? String(profile.active_lines) : "";
    }
  }
});

function formatWhatsapp(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 11) digits = digits.slice(0, 11);
  digits = digits.replace(/^(\d{2})(\d)/, "($1) $2");
  digits = digits.replace(/(\d)(\d{4})$/, "$1-$2");
  return digits;
}

function showError(errorBox, message) {
  if (!errorBox) return;
  errorBox.textContent = message || "Ocorreu um erro.";
  errorBox.hidden = false;
}

function hideError(errorBox) {
  if (!errorBox) return;
  errorBox.hidden = true;
  errorBox.textContent = "";
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
    const container = document.querySelector(".user-menu-container");
    if (!container) {
      close();
      return;
    }

    if (!container.contains(e.target)) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function initTheme(themeToggle) {
  if (!themeToggle) return;

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    updateThemeIcon(themeToggle, true);
  } else {
    document.body.classList.remove("dark-mode");
    updateThemeIcon(themeToggle, false);
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateThemeIcon(themeToggle, isDark);
  });
}

function updateThemeIcon(btn, isDark) {
  const icon = btn?.querySelector("i");
  const text = btn?.querySelector("span");
  const logoEscuro = document.querySelector(".logo-escuro");
  const logoClaro = document.querySelector(".logo-claro");

  if (icon && text) {
    icon.className = isDark ? "ph ph-sun" : "ph ph-moon";
    text.textContent = isDark ? "Modo claro" : "Modo escuro";
  }

  if (logoEscuro && logoClaro) {
    logoEscuro.style.display = isDark ? "block" : "none";
    logoClaro.style.display = isDark ? "none" : "block";
  }
}