// cadastro.js — Supabase (fluxo correto para não “sujar” o Auth quando CPF/Email já existem)
// Mantém: máscaras, toggle senha, submit
// Faz: chama endpoint server-side /api/register (Vercel Function) que valida e cria usuário+perfil de forma atômica

document.addEventListener("DOMContentLoaded", async () => {
  // --- 1) MÁSCARAS ---
  const docInput = document.getElementById("document");
  const phoneInput = document.getElementById("whatsapp");


  const sb = await getSupabaseClient();
  const { data } = await sb.auth.getSession();

  if (data?.session) {
    window.location.href = "../hub/hub.html";
    return;
  }


  if (!docInput || !phoneInput) return;

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

  // --- 2) MOSTRAR SENHA ---
  const toggleBtn = document.getElementById("toggle-password");
  const passInput = document.getElementById("password");

  if (toggleBtn && passInput) {
    toggleBtn.addEventListener("click", () => {
      const type =
        passInput.getAttribute("type") === "password" ? "text" : "password";
      passInput.setAttribute("type", type);

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.classList.toggle("ph-eye");
        icon.classList.toggle("ph-eye-slash");
      }
    });
  }

  // --- 3) SUBMIT (via /api/register) ---
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameValue = (document.getElementById("name")?.value || "").trim();
    const emailValue = (document.getElementById("email")?.value || "").trim();
    const passwordValue = document.getElementById("password")?.value || "";

    const doc = docInput.value.replace(/\D/g, "");

    if (doc.length === 11) {
      if (!validarCPF(doc)) {
        alert("CPF inválido.");
        return;
      }
    } else if (doc.length === 14) {
      if (!validarCNPJ(doc)) {
        alert("CNPJ inválido.");
        return;
      }
    } else {
      alert("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      return;
    }

    const whatsapp = phoneInput.value.replace(/\D/g, "");

    const btn = form.querySelector(".register-btn");
    const originalText = btn?.innerText || "Criar conta";

    if (btn) {
      btn.innerText = "Criando conta...";
      btn.disabled = true;
    }

    try {
      // Payload para o backend (Vercel Function)
      const payload = {
        name: nameValue,
        email: emailValue,
        password: passwordValue,
        cpf: doc,
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
          alert("Este CPF já está cadastrado.");
          return;
        }

        if (err === "auth_error") {
          // normalmente email já cadastrado
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




  // Valida CPF (aceita com ou sem máscara)
// Retorna true/false
function validarCPF(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");

  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // rejeita 000... 111... etc.

  const calcDV = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcDV(c.slice(0, 9), 10);
  const dv2 = calcDV(c.slice(0, 9) + dv1, 11);

  return c === c.slice(0, 9) + String(dv1) + String(dv2);
}

// Valida CNPJ (aceita com ou sem máscara)
// Retorna true/false
function validarCNPJ(cnpj) {
  const c = String(cnpj || "").replace(/\D/g, "");

  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // rejeita 000... 111... etc.

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

// (Opcional) Valida CPF ou CNPJ automaticamente pelo tamanho
function validarCpfOuCnpj(doc) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

});