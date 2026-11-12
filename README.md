# Provador virtual

Primeiro corte do piloto. O link /?peca=UUID abre uma prova para uma peça
habilitada. A visitante envia uma foto e recebe uma simulação pela API da OpenAI.

## Rodar

1. Instale as dependências com npm install.
2. Aplique a migração no projeto Supabase do provador.
3. Configure as variáveis de .env.example no ambiente local e na Vercel.
4. Cadastre uma loja e uma peça habilitada. A foto da peça deve estar em
   HTTPS, no host de imagens controlado pelo piloto.
5. Execute npm run dev ou faça o deploy e abra o link da peça.

Neste primeiro corte, a foto e o resultado passam apenas pela requisição
e pela OpenAI. O app não grava as imagens. Cada tentativa reserva uma
unidade do teto interno da loja, inclusive em falhas, para limitar gastos.
Esse teto não representa faturamento do lojista.

Ainda faltam upload direto e armazenamento privado no R2, fila durável,
proteção antibot, painel, recargas e integração com a vitrine.
Mantenha o deploy protegido para testes internos até completar esses itens.
