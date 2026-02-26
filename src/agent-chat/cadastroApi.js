const modal = document.getElementById('modalApi');
const btnAbrir = document.getElementById('btnAbrirModalApi');
const btnFechar = document.getElementById('btnFecharModal');
const inputIdentificador = document.getElementById('identificador');
const inputApiKey = document.getElementById('apiKey');
const btnMostrarSenha = document.getElementById('btnMostrarSenha');

// Abrir e fechar o Modal
btnAbrir.addEventListener('click', () => {
    modal.classList.remove('modal-oculto');
    modal.classList.add('modal-visivel');
});

btnFechar.addEventListener('click', fecharModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) fecharModal();
});

function fecharModal() {
    modal.classList.remove('modal-visivel');
    setTimeout(() => { modal.classList.add('modal-oculto'); }, 300); // Espera a animação terminar
}

// Lógica de Mostrar/Ocultar Senha
btnMostrarSenha.addEventListener('click', () => {
    const tipoAtual = inputApiKey.getAttribute('type');
    if (tipoAtual === 'password') {
        inputApiKey.setAttribute('type', 'text');
        btnMostrarSenha.innerText = '🙈'; // Muda o ícone
    } else {
        inputApiKey.setAttribute('type', 'password');
        btnMostrarSenha.innerText = '👁️';
    }
});

// A MÁSCARA INTELIGENTE (Detecta Telefone ou E-mail)
inputIdentificador.addEventListener('input', function(e) {
    let valor = e.target.value;
    
    // Se conter letras ou '@', assumimos que é e-mail e não aplicamos máscara de números
    if (/[a-zA-Z@]/.test(valor)) {
        return; // Deixa o usuário digitar o e-mail livremente
    }
    
    // Se forem apenas números, aplicamos a máscara do WhatsApp (XX) XXXXX-XXXX
    let v = valor.replace(/\D/g, ""); // Remove tudo que não for número
    if (v.length > 11) v = v.slice(0, 11); // Limita a 11 dígitos
    
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (v.length > 7) v = v.replace(/(\d{5})(\d)/, "$1-$2");
    
    e.target.value = v; // Devolve o valor formatado para o campo
});

// Lógica de envio para o n8n
document.getElementById('formApi').addEventListener('submit', async function(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById('btnSubmit');
    const divMensagem = document.getElementById('mensagem');
    let identificadorOriginal = inputIdentificador.value;
    const apiKey = inputApiKey.value;

    // LIMPEZA DO DADO: Se for número de telefone, tira a máscara antes de enviar pro n8n
    // para o Supabase conseguir achar o cliente facilmente (ex: manda "21999999999" em vez de "(21) 99999-9999")
    let identificadorLimpo = identificadorOriginal;
    if (!/[a-zA-Z@]/.test(identificadorOriginal)) {
        identificadorLimpo = identificadorOriginal.replace(/\D/g, ''); 
    }

    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Autenticando...';
    divMensagem.innerText = '';
    divMensagem.className = '';

    // URL DO SEU N8N
    const webhookUrl = 'https://SEU-DOMINIO-RAILWAY.up.railway.app/webhook-test/cadastrar-chave';

    try {
        const resposta = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                whatsapp: identificadorLimpo, // Enviamos o número limpo ou o e-mail cru
                chave_gemini_recebida: apiKey
            })
        });

        if (resposta.ok) {
            divMensagem.innerText = '✨ Chave validada e conectada!';
            divMensagem.className = 'sucesso';
            inputApiKey.value = ''; 
            
            setTimeout(() => {
                fecharModal();
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
        btnSubmit.innerText = 'Conectar Agora';
    }
});