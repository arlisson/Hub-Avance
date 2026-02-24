// cadastro.js — Supabase (fluxo correto para não “sujar” o Auth quando CPF/CNPJ/Email já existem)
// Mantém: máscaras, toggle senha, submit
// Faz: validação em tempo real (CPF/CNPJ e e-mail) com destaque vermelho + mensagem abaixo
// e chama endpoint server-side /api/register (Vercel Function)

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

function validarCpfOuCnpj(doc) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

function validarEmail(email) {
  const v = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

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

function setValid(inputEl) {
  const group = inputEl?.closest?.(".input-group");
  if (!group) return;

  group.classList.remove("is-invalid");
  const err = group.querySelector(".input-error");
  if (err) err.textContent = "";
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

    // enquanto digita: só valida quando chegar a 11 ou 14; antes disso não “pune”
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

    // enquanto digita: só marca inválido se houver texto e já estiver claramente errado
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

    // validação final antes de enviar (garante que não passa se estiver inválido)
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
        cpf: docRaw, // mantém a chave "cpf" para não quebrar seu backend
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
          setInvalid(emailInput, "E-mail já cadastrado");
          alert("Este e-mail já está cadastrado.");
          return;
        }

        if (err === "missing_fields") {
          alert("Preencha os campos obrigatórios.");
          return;
        }

        alert("Erro ao cadastrar. Verifique os dados e tente novamente.");
        return;
      }

      alert("Conta criada com sucesso! Redirecionando para o login...");
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