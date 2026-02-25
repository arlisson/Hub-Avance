// Captura os elementos do Modal
const modal = document.getElementById('modalApi');
const btnAbrir = document.getElementById('btnAbrirModalApi');
const btnFechar = document.getElementById('btnFecharModal');

// Abre o pop-up ao clicar no botão
btnAbrir.addEventListener('click', () => {
    modal.classList.remove('modal-oculto');
    modal.classList.add('modal-visivel');
});

// Fecha o pop-up ao clicar no 'X'
btnFechar.addEventListener('click', () => {
    modal.classList.remove('modal-visivel');
    modal.classList.add('modal-oculto');
});

// Fecha o pop-up se o usuário clicar na área escura (fora da caixinha)
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.classList.remove('modal-visivel');
        modal.classList.add('modal-oculto');
    }
});

// Lógica de envio para o n8n
document.getElementById('formApi').addEventListener('submit', async function(event) {
    event.preventDefault();

    const telefone = document.getElementById('telefone').value;
    const apiKey = document.getElementById('apiKey').value;
    const btnSubmit = document.getElementById('btnSubmit');
    const divMensagem = document.getElementById('mensagem');

    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Autenticando...';
    divMensagem.innerText = '';

    // Lembre-se de colocar a URL do seu nó Webhook da Railway aqui
    const webhookUrl = 'https://SEU-DOMINIO-RAILWAY.up.railway.app/webhook-test/cadastrar-chave';

    try {
        const resposta = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telefone_cliente: telefone,
                chave_openai_recebida: apiKey
            })
        });

        if (resposta.ok) {
            divMensagem.innerText = 'Chave conectada com sucesso!';
            divMensagem.className = 'sucesso';
            document.getElementById('apiKey').value = ''; 
            
            // Opcional: Fecha o pop-up automaticamente 2 segundos após o sucesso
            setTimeout(() => {
                modal.classList.remove('modal-visivel');
                modal.classList.add('modal-oculto');
                divMensagem.innerText = ''; // limpa a mensagem para a próxima abertura
            }, 2000);

        } else {
            divMensagem.innerText = 'Falha ao conectar. Verifique o servidor.';
            divMensagem.className = 'erro';
        }
    } catch (erro) {
        console.error('Erro:', erro);
        divMensagem.innerText = 'Erro de conexão com o n8n.';
        divMensagem.className = 'erro';
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Conectar Chave';
    }
});