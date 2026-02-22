// cadastro.js — Supabase (sem n8n)
// Mantém: máscaras, toggle senha, submit
// Faz: auth.signUp + UPDATE em public.profiles
// Requer: trigger no Supabase para criar a linha em profiles ao criar o usuário

document.addEventListener("DOMContentLoaded", () => {
  // --- 1) MÁSCARAS ---
  const docInput = document.getElementById("document");
  const phoneInput = document.getElementById("whatsapp");

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

  // --- 3) SUBMIT (Supabase) ---
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameValue = (document.getElementById("name")?.value || "").trim();
    const emailValue = (document.getElementById("email")?.value || "").trim();
    const passwordValue = document.getElementById("password")?.value || "";

    const cpfCnpj = docInput.value.replace(/\D/g, "");
    const whatsapp = phoneInput.value.replace(/\D/g, "");

    const btn = form.querySelector(".register-btn");
    const originalText = btn?.innerText || "Criar conta";

    if (btn) {
      btn.innerText = "Criando conta...";
      btn.disabled = true;
    }

    try {
      const supabase = window.supabaseClient;
      if (!supabase) throw new Error("Supabase client não carregado.");

      // 1) cria usuário no Auth
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: emailValue,
          password: passwordValue,
        });

      if (signUpError) throw signUpError;

      // Se confirmação de e-mail estiver ligada, user pode vir null aqui.
      // Mesmo assim, o trigger (no Supabase) cria a linha em profiles.
      const userId = signUpData?.user?.id;

      // 2) se tiver userId (sessão imediata), completa o profile com UPDATE
      if (userId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            name: nameValue,
            cpf: cpfCnpj,
            whatsapp: whatsapp,
          })
          .eq("id", userId);

        if (updateError) throw updateError;

        alert("Conta criada com sucesso! Redirecionando para o login...");
        window.location.href = "../login/login.html";
        return;
      }

      // 3) sem userId: confirmação ligada ou sessão não criada agora
      alert(
        "Conta criada. Verifique seu e-mail para confirmar e então faça login.",
      );
      window.location.href = "../login/login.html";
    } catch (error) {
      console.error("Erro:", error);

      const msg = (error?.message || "").toLowerCase();

      if (msg.includes("user already registered") || msg.includes("already")) {
        alert("Este e-mail já está cadastrado.");
      } else if (msg.includes("duplicate key") || msg.includes("unique")) {
        alert("CPF ou e-mail já existem.");
      } else if (msg.includes("row-level security") || msg.includes("rls")) {
        alert(
          "Erro de permissão ao salvar o perfil. Confirme se o trigger/policies do profiles estão configurados.",
        );
      } else {
        alert(
          `Erro ao cadastrar: ${
            error?.message || "Verifique os dados e tente novamente."
          }`,
        );
      }
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  });
});