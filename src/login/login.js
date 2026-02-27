// login.js — versão para Supabase (com validação de e-mail em tempo real)
// Mantém: verificação de elementos, máscara, toggle de senha e submit.

/**
 * Valida se uma string tem formato básico de e-mail.
 *
 * Observação: valida apenas o padrão (ex.: "nome@dominio.com"),
 * não garante existência real do e-mail.
 *
 * @param {string} email - E-mail a validar.
 * @returns {boolean} `true` se o formato for válido, senão `false`.
 */
function validarEmail(email) {
  const v = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Marca um campo como inválido no UI e exibe uma mensagem de erro dentro
 * do `.input-group` mais próximo.
 *
 * Estrutura esperada:
 * - O input deve estar dentro de um elemento `.input-group`.
 * - Um `.input-error` será criado se não existir.
 *
 * @param {HTMLElement|null|undefined} inputEl - Elemento de input alvo.
 * @param {string} message - Mensagem de erro a exibir.
 * @returns {void}
 */
function setInvalid(inputEl, message) {
  const group = inputEl?.closest?.(".input-group");
  if (!group) return;

  group.classList.add("is-invalid");

  let err = group.querySelector(".input-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "input-error";
    group.appendChild(err);
  }
  err.textContent = message || "Inválido";
}

/**
 * Remove o estado inválido do UI do `.input-group` mais próximo
 * e limpa a mensagem de erro (se existir).
 *
 * @param {HTMLElement|null|undefined} inputEl - Elemento de input alvo.
 * @returns {void}
 */
function setValid(inputEl) {
  const group = inputEl?.closest?.(".input-group");
  if (!group) return;

  group.classList.remove("is-invalid");
  const err = group.querySelector(".input-error");
  if (err) err.textContent = "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const loginForm = document.getElementById("login-form");
  const toggleBtn = document.getElementById("toggle-password");

  if (!identifierInput || !passwordInput || !loginForm) return;

  const sb = await getSupabaseClient();
  const { data } = await sb.auth.getSession();

  if (data?.session) {
    window.location.href = "../hub/hub.html";
    return;
  }

  // --- MÁSCARA (mantida) ---
  identifierInput.addEventListener("input", (e) => {
    let value = e.target.value;
    const isEmail = /[a-zA-Z@]/.test(value);

    // if (!isEmail) {
    //   value = value.replace(/\D/g, "");
    //   if (value.length > 11) value = value.slice(0, 11);
    //   if (value.length > 2) value = value.replace(/^(\d{2})(\d)/, "($1) $2");
    //   if (value.length > 7) value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    //   e.target.value = value;
    // }
  });

  // --- VALIDAÇÃO EM TEMPO REAL (E-MAIL) ---

  /**
   * Validação “leve” do e-mail durante digitação.
   * Só marca como inválido quando o usuário já digitou algo;
   * quando vazio, apenas limpa o erro.
   *
   * @returns {boolean} `true` se estiver válido (ou vazio), senão `false`.
   */
  const validateEmailSoft = () => {
    const v = identifierInput.value.trim();

    // só marca inválido quando o usuário já digitou algo
    if (!v) {
      setValid(identifierInput);
      return true;
    }

    if (!validarEmail(v)) {
      setInvalid(identifierInput, "E-mail inválido");
      return false;
    }

    setValid(identifierInput);
    return true;
  };

  /**
   * Validação “forte” do e-mail (para submissão/saída do campo).
   * Quando inválido, marca o campo e impede continuidade.
   *
   * @returns {boolean} `true` se válido, senão `false`.
   */
  const validateEmailHard = () => {
    const v = identifierInput.value.trim();
    if (!validarEmail(v)) {
      setInvalid(identifierInput, "E-mail inválido");
      return false;
    }
    setValid(identifierInput);
    return true;
  };

  identifierInput.addEventListener("input", validateEmailSoft);
  identifierInput.addEventListener("blur", validateEmailHard);

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

    const email = (identifierInput.value || "").trim();
    const password = passwordInput.value || "";

    // validação final antes de enviar
    if (!validateEmailHard()) return;

    if (!password) {
      alert("Informe sua senha.");
      return;
    }

    if (btn) {
      btn.innerText = "Entrando...";
      btn.disabled = true;
    }

    try {
      const supabase = await window.getSupabaseClient();
      if (!supabase) throw new Error("Supabase client não carregado.");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      window.location.href = "../hub/hub.html";
    } catch (error) {
      alert(`Erro: ${error?.message || "Falha no login."}`);
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  });
});

// Reset senha (mantido)
const forgotLink = document.getElementById("forgot-password-link");

if (forgotLink) {
  forgotLink.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("identifier")?.value || "").trim();
    if (!validarEmail(email)) {
      alert("Digite seu e-mail no campo acima para receber o link de redefinição.");
      return;
    }

    const supabase = await window.getSupabaseClient();
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