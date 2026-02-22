// cadastro.js — cria usuário via /api/register e exige confirmação de e-mail
document.addEventListener("DOMContentLoaded", () => {
  const docInput = document.getElementById("document");
  const phoneInput = document.getElementById("whatsapp");
  const form = document.getElementById("register-form");

  if (!docInput || !phoneInput || !form) return;

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

  // Toggle senha
  const toggleBtn = document.getElementById("toggle-password");
  const passInput = document.getElementById("password");
  if (toggleBtn && passInput) {
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameValue = (document.getElementById("name")?.value || "").trim();
    const emailValue = (document.getElementById("email")?.value || "").trim();
    const passwordValue = document.getElementById("password")?.value || "";

    const cpfCnpj = docInput.value.replace(/\D/g, "");
    const whatsapp = phoneInput.value.replace(/\D/g, "");

    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      alert("Informe um e-mail válido.");
      return;
    }
    if (!passwordValue || passwordValue.length < 8) {
      alert("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!cpfCnpj) {
      alert("Informe CPF/CNPJ.");
      return;
    }

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
        cpf: cpfCnpj,
        whatsapp,
      };

      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 429: rate limit
      if (r.status === 429) {
        alert("Muitas tentativas em pouco tempo. Aguarde 1 minuto e tente novamente.");
        return;
      }

      const out = await r.json().catch(() => null);

      if (!r.ok || !out?.ok) {
        const err = out?.error || "unknown_error";

        if (err === "cpf_exists") {
          alert("Este CPF/CNPJ já está cadastrado.");
          return;
        }

        if (err === "email_exists") {
          alert("Este e-mail já está cadastrado.");
          return;
        }

        if (err === "weak_password") {
          alert("Senha fraca. Use pelo menos 8 caracteres.");
          return;
        }

        alert(out?.detail || "Erro ao cadastrar. Tente novamente.");
        return;
      }

      alert("Conta criada. Verifique seu e-mail para confirmar antes de fazer login.");
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