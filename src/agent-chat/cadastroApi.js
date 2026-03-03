// Captura dos elementos HTML com os IDs atualizados
const modal = document.getElementById('modalApi');
const btnAbrir = document.getElementById('btnAbrirModalSidebar'); // ID novo do botão na sidebar
const btnFechar = document.getElementById('btnFecharModal');
const inputApiKey = document.getElementById('apiKey');
//const inputIdentificador = document.getElementById('identificador');
const btnMostrarSenha = document.getElementById('btnMostrarSenha');

// Lógica de Abrir e Fechar o Modal
btnAbrir.addEventListener('click', () => modal.classList.add('visivel'));
btnFechar.addEventListener('click', () => modal.classList.remove('visivel'));
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visivel');
});

// Lógica de Mostrar/Ocultar Senha (com FontAwesome)
btnMostrarSenha.addEventListener('click', () => {
    const isPassword = inputApiKey.type === 'password';
    inputApiKey.type = isPassword ? 'text' : 'password';

    // Alterna os ícones do olho aberto/fechado
    btnMostrarSenha.classList.toggle('fa-eye');
    btnMostrarSenha.classList.toggle('fa-eye-slash');
});

// Lógica de envio para o n8n
document.getElementById('formApi').addEventListener('submit', async function (event) {
    event.preventDefault();

    const btnSubmit = document.getElementById('btnSubmit');
    const divMensagem = document.getElementById('mensagemApi'); // ID novo da div de mensagens do modal
    //let identificadorOriginal = inputIdentificador.value;
    const apiKey = inputApiKey.value;

    // LIMPEZA DO DADO: Se for número de telefone, tira a máscara antes de enviar pro n8n
    // let identificadorLimpo = identificadorOriginal;
    // if (!/[a-zA-Z@]/.test(identificadorOriginal)) {
    //     identificadorLimpo = identificadorOriginal.replace(/\D/g, '');
    // }

    // Procura o elemento onde o agent.js injetou o email
    const elementoEmail = document.getElementById("user-email");
    // Se o elemento existir, pega o texto. Se não, manda "nao_informado" por segurança
    const emailUsuario = elementoEmail ? elementoEmail.textContent.trim() : "nao_informado";

    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Autenticando...';
    divMensagem.innerText = '';
    divMensagem.className = '';

    // URL DO SEU N8N
    const webhookUrl = 'https://primary-production-335ec.up.railway.app/webhook/registro_api';

    try {
        const resposta = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailUsuario,
                chave_gemini_recebida: apiKey
            })
        });

        if (resposta.ok) {
            divMensagem.innerText = 'Chave validada e conectada!';
            divMensagem.className = 'sucesso';
            inputApiKey.value = '';

            // Alterar cor da bolinha de "online/offline" 
            if (typeof window.atualizarStatusAgente === 'function') {
                window.atualizarStatusAgente(true);
            }

            // Fecha o modal automaticamente após o sucesso
            setTimeout(() => {
                modal.classList.remove('visivel');
                divMensagem.innerText = '';
                divMensagem.className = '';
            }, 2500);

        } else {
            divMensagem.innerText = 'Falha ao conectar. Tente novamente.';
            divMensagem.className = 'erro';
        }
    } catch (erro) {
        divMensagem.innerText = 'Erro de conexão com o servidor.';
        divMensagem.className = 'erro';
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Salvar Credencial';
    }
});