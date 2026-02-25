// cadastro.js — Supabase (fluxo com confirmação de e-mail)
// Mantém: máscaras, toggle senha, submit
// Faz: validação em tempo real (CPF/CNPJ e e-mail) com destaque vermelho + mensagem abaixo
// Chama endpoint server-side /api/register (Vercel Function)
// Agora: ao sucesso, informa que foi enviado link de confirmação e redireciona para login

/**
 * Validates a Brazilian CPF (Cadastro de Pessoas Físicas) number.
 * 
 * @param {string|number} cpf - The CPF number to validate. Can be a string or number,
 *                               with or without formatting characters.
 * @returns {boolean} Returns true if the CPF is valid, false otherwise.
 * 
 * @example
 * validarCPF("123.456.789-09"); // returns true or false
 * validarCPF("12345678909");    // returns true or false
 * validarCPF(12345678909);      // returns true or false
 * 
 * @description
 * The function validates a CPF by:
 * 1. Removing all non-digit characters
 * 2. Checking if the length is exactly 11 digits
 * 3. Rejecting sequences of identical digits
 * 4. Verifying the first check digit (position 9)
 * 5. Verifying the second check digit (position 10)
 */
function validarCPF(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  const calcDV = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcDV(c.slice(0, 9), 10);
  const dv2 = calcDV(c.slice(0, 9) + String(dv1), 11);

  return c === c.slice(0, 9) + String(dv1) + String(dv2);
}

/**
 * Validates a Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica) number.
 * 
 * @param {string|number} cnpj - The CNPJ number to validate. Can be provided as a string or number.
 * @returns {boolean} True if the CNPJ is valid, false otherwise.
 * 
 * @description
 * This function validates a CNPJ by:
 * 1. Removing all non-digit characters
 * 2. Checking if the length is exactly 14 digits
 * 3. Rejecting CNPJs where all digits are the same
 * 4. Validating the two check digits using modulo 11 algorithm
 * 
 * @example
 * validarCNPJ("11.222.333/0001-81"); // returns true or false
 * validarCNPJ(11222333000181); // returns true or false
 */
function validarCNPJ(cnpj) {
  const c = String(cnpj || "").replace(/\D/g, "");
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  const calcDV = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base12 = c.slice(0, 12);
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcDV(base12, pesos1);

  const base13 = base12 + String(dv1);
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv2 = calcDV(base13, pesos2);

  return c === base12 + String(dv1) + String(dv2);
}

/**
 * Validates a CPF or CNPJ document number.
 * @param {string|number} doc - The CPF or CNPJ document number to validate (with or without formatting).
 * @returns {boolean} True if the document is a valid CPF (11 digits) or CNPJ (14 digits), false otherwise.
 */
function validarCpfOuCnpj(doc) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

/**
 * Validates if a given string is a valid email address.
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email is valid, false otherwise.
 */
function validarEmail(email) {
  const v = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Marks an input element as invalid and displays an error message.
 * @param {HTMLElement} inputEl - The input element to mark as invalid
 * @param {string} [message="Inválido"] - The error message to display
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
 * Removes the invalid state from an input group and clears any associated error message.
 * @param {HTMLElement} inputEl - The input element whose parent input group should be validated.
 * @returns {void}
 */
function setValid(inputEl) {
  const group = inputEl?.closest?.(".input-group");
  if (!group) return;

  group.classList.remove("is-invalid");
  const err = group.querySelector(".input-error");
  if (err) err.textContent = "";
}

/**
 * Converts authentication error messages into user-friendly Portuguese messages.
 * @param {string|*} detailOrMessage - The error message or detail to be converted.
 * @returns {string} A user-friendly error message in Portuguese.
 * @example
 * friendlyAuthMessage("user already registered");
 * // Returns: "Este e-mail já está cadastrado."
 */
function friendlyAuthMessage(detailOrMessage) {
  const t = String(detailOrMessage || "").toLowerCase();

  if (t.includes("user already registered") || t.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (t.includes("invalid email")) {
    return "E-mail inválido.";
  }
  if (t.includes("password")) {
    return "Senha inválida. Verifique os requisitos e tente novamente.";
  }
  if (t.includes("rate") || t.includes("too many")) {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }
  return "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.";
}

document.addEventListener("DOMContentLoaded", async () => {
  // --- ELEMENTOS ---
  const docInput = document.getElementById("document");
  const phoneInput = document.getElementById("whatsapp");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const toggleBtn = document.getElementById("toggle-password");
  const form = document.getElementById("register-form");

  // --- REDIRECIONA SE JÁ ESTIVER LOGADO ---
  try {
    const sb = await getSupabaseClient();
    const { data } = await sb.auth.getSession();

    if (data?.session) {
      window.location.href = "../hub/hub.html";
      return;
    }
  } catch (_) {
    // se falhar, apenas segue (sem travar tela)
  }

  if (!docInput || !phoneInput || !emailInput || !passInput || !form) return;

  // --- 1) MÁSCARAS ---
  // Máscara CPF/CNPJ
  docInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 14) value = value.slice(0, 14);

    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      value = value.replace(/^(\d{2})(\d)/, "$1.$2");
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
      value = value.replace(/(\d{4})(\d)/, "$1-$2");
    }

    e.target.value = value;
  });

  // Máscara WhatsApp
  phoneInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value;
  });

  // --- 2) VALIDAÇÃO EM TEMPO REAL (CPF/CNPJ e E-mail) ---
  const validateDocSoft = () => {
    const raw = docInput.value.replace(/\D/g, "");

    if (!raw) {
      setValid(docInput);
      return true;
    }
    if (raw.length !== 11 && raw.length !== 14) {
      setValid(docInput);
      return true;
    }

    if (!validarCpfOuCnpj(raw)) {
      setInvalid(docInput, "CPF/CNPJ inválido");
      return false;
    }

    setValid(docInput);
    return true;
  };

  const validateDocHard = () => {
    const raw = docInput.value.replace(/\D/g, "");
    if (!raw || (raw.length !== 11 && raw.length !== 14) || !validarCpfOuCnpj(raw)) {
      setInvalid(docInput, "CPF/CNPJ inválido");
      return false;
    }
    setValid(docInput);
    return true;
  };

  const validateEmailSoft = () => {
    const v = emailInput.value.trim();

    if (!v) {
      setValid(emailInput);
      return true;
    }

    if (!validarEmail(v)) {
      setInvalid(emailInput, "E-mail inválido");
      return false;
    }

    setValid(emailInput);
    return true;
  };

  const validateEmailHard = () => {
    const v = emailInput.value.trim();
    if (!validarEmail(v)) {
      setInvalid(emailInput, "E-mail inválido");
      return false;
    }
    setValid(emailInput);
    return true;
  };

  docInput.addEventListener("input", validateDocSoft);
  docInput.addEventListener("blur", validateDocHard);

  emailInput.addEventListener("input", validateEmailSoft);
  emailInput.addEventListener("blur", validateEmailHard);

  // --- 3) MOSTRAR SENHA ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const type = passInput.getAttribute("type") === "password" ? "text" : "password";
      passInput.setAttribute("type", type);

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.classList.toggle("ph-eye");
        icon.classList.toggle("ph-eye-slash");
      }
    });
  }

  // --- 4) SUBMIT (via /api/register) ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameValue = (document.getElementById("name")?.value || "").trim();
    const emailValue = emailInput.value.trim();
    const passwordValue = passInput.value || "";

    const docRaw = docInput.value.replace(/\D/g, "");
    const whatsapp = phoneInput.value.replace(/\D/g, "");

    const okDoc = validateDocHard();
    const okEmail = validateEmailHard();

    if (!okDoc || !okEmail) return;

    const btn = form.querySelector(".register-btn");
    const originalText = btn?.innerText || "Cadastrar";

    if (btn) {
      btn.innerText = "Criando conta...";
      btn.disabled = true;
    }

    try {
      const payload = {
        name: nameValue,
        email: emailValue,
        password: passwordValue,
        cpf: docRaw,
        whatsapp: whatsapp,
      };

      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await r.json().catch(() => null);

      if (!r.ok || !out?.ok) {
        const err = out?.error || "unknown_error";

        if (err === "cpf_exists") {
          setInvalid(docInput, "CPF/CNPJ já cadastrado");
          alert("Este CPF/CNPJ já está cadastrado.");
          return;
        }

        if (err === "auth_error") {
          // tenta mostrar uma mensagem mais precisa se o backend devolver "detail"
          const msg = friendlyAuthMessage(out?.detail || out?.message);
          setInvalid(emailInput, msg);
          alert(msg);
          return;
        }

        if (err === "missing_fields") {
          alert("Preencha os campos obrigatórios.");
          return;
        }

        if (err === "sheets_failed") {
          alert("Cadastro indisponível no momento. Tente novamente em instantes.");
          return;
        }

        alert("Erro ao cadastrar. Verifique os dados e tente novamente.");
        return;
      }

      // NOVO: fluxo com confirmação de e-mail
      alert(
        "Cadastro realizado. Enviamos um link de confirmação para seu e-mail. " +
          "Confirme o link para liberar o login. Verifique também a caixa de spam."
      );
      window.location.href = "../login/login.html";
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro de conexão. Tente novamente.");
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  });
});