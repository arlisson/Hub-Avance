document.addEventListener('DOMContentLoaded', () => {

  const modalApi = document.getElementById('modalApi');
  const btnAbrirModal = document.getElementById('btnAbrirModalSidebar');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const formApi = document.getElementById('formApi');
  const inputApiKey = document.getElementById('apiKey');
  const btnMostrarSenha = document.getElementById('btnMostrarSenha');
  const mensagemApi = document.getElementById('mensagemApi');


  // Função para abrir o modal
  btnAbrirModal.addEventListener('click', () => {
    modalApi.classList.add('active');
    
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey && inputApiKey) inputApiKey.value = savedKey;
  });

  // Função para fechar o modal
  const fecharModal = () => {
    modalApi.classList.remove('active');
    if (mensagemApi) {
      mensagemApi.textContent = '';
      mensagemApi.className = 'mensagem-feedback';
    }
  };

  if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModal);

  modalApi.addEventListener('click', (e) => {
    if (e.target === modalApi) fecharModal();
  });

  // Lógica do Olhinho (Mostrar/Ocultar Senha)
  if (btnMostrarSenha && inputApiKey) {
    btnMostrarSenha.addEventListener('click', () => {
      const icon = btnMostrarSenha.querySelector('i');
      if (inputApiKey.type === 'password') {
        inputApiKey.type = 'text';
        if(icon) icon.className = 'ph ph-eye-slash input-icon';
      } else {
        inputApiKey.type = 'password';
        if(icon) icon.className = 'ph ph-eye input-icon';
      }
    });
  }

  // Lógica de Salvar a Chave
  if (formApi) {
    formApi.addEventListener('submit', (e) => {
      e.preventDefault(); 
      
      const apiKey = inputApiKey.value.trim();
      
      if (apiKey.length < 10) {
        mensagemApi.textContent = 'Por favor, insira uma chave de API válida.';
        mensagemApi.className = 'mensagem-feedback mensagem-erro';
        return;
      }

      localStorage.setItem('gemini_api_key', apiKey);
      
      mensagemApi.textContent = 'Chave conectada com sucesso!';
      mensagemApi.className = 'mensagem-feedback mensagem-sucesso';

      // Atualiza o status visual do agente para online (se a função existir no agent.js)
      if (typeof window.atualizarStatusAgente === 'function') {
        window.atualizarStatusAgente(true);
      }

      setTimeout(() => {
        fecharModal();
      }, 1500);
    });
  }
});