// Arquivo: api/webhook.js

export default async function handler(req, res) {
  // 1. Bloqueia qualquer requisição que não seja POST por segurança
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // 2. Puxa a sua URL secreta do n8n salva nas variáveis da Vercel
  // ATENÇÃO: O nome lá no painel da Vercel tem que ser exatamente N8N_WEBHOOK_URL
  const n8nWebhookUrl = process.env.N8N_CADASTRAR_API_WEBHOOK_URL;

  if (!n8nWebhookUrl) {
    return res.status(500).json({ error: 'Variável de ambiente N8N_WEBHOOK_URL não configurada.' });
  }

  try {
    // 3. Pega os dados que o seu frontend mandou e repassa para o n8n online
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body) 
    });

    if (!response.ok) {
      throw new Error(`Erro no n8n: ${response.statusText}`);
    }

    // 4. Avisa o frontend que deu tudo certo
    return res.status(200).json({ success: true, message: 'Webhook acionado com sucesso no n8n!' });

  } catch (error) {
    console.error('Erro na API Interna:', error);
    return res.status(500).json({ success: false, error: 'Falha ao acionar o webhook do n8n.' });
  }
}