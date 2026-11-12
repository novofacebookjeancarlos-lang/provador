# Provador virtual

Next.js na Vercel, Supabase para login, catálogo, saldo e imagens de peças.
OpenAI Images Edits em qualidade low. Fotos de visitantes e resultados
são transitórios e retornam na própria requisição.

## Piloto

- / abre o teste com duas fotos e teto de 20 tentativas.
- /painel permite criar conta, confirmar e-mail, cadastrar loja, cadastrar
  uma foto por peça ou variante e copiar o link /?peca=UUID.
- O link público mostra a peça e pede só a foto da visitante.
- Pausar uma peça desativa seu link. O retorno à compra usa o link da loja.
- Cada tentativa em loja reserva um crédito atomicamente. Falha confirmada
  restitui o saldo. Timeout ou falha ambígua fica pendente para revisão.
- Após confirmar um pagamento manual, o operador usa a função pilot_credit
  no SQL Editor com ID da loja, quantidade e referência única do pagamento.
  A mesma referência não credita duas vezes. Novas lojas começam com zero.

## Configuração

Use npm ci e npm run build. Aplique as migrações em ordem no Supabase.
Configure as variáveis de .env.example na Vercel. GARMENT_ASSET_HOST só
é necessário para peças legadas que usam imagem externa. Configure a URL
do painel no Auth do Supabase e o envio de e-mail de confirmação.

A integração automática com a vitrine, checkout, fila durável e Cloudflare
R2 seguem como próximos passos. O piloto usa Supabase Storage só para
as fotos das peças. Limite a distribuição dos links durante o piloto.

## Botão na Shopify

No painel, associe cada peça ao ID da variante da vitrine e abra
“Instalar botão na vitrine”. Cole o trecho num bloco Liquid personalizado
em um tema compatível. O widget resolve a variante atual pelo formulário
do produto ou pela URL. Teste o comportamento em cada tema antes de
ativar para clientes. O cadastro e o mapeamento são manuais.

O limite inicial é de 20 tentativas por loja em uma janela móvel de 24h,
além do saldo pré-pago. O operador pode configurar daily_limit na tabela
pilot_stores. Esse teto limita gasto e não substitui proteção antibot.

## Recargas no painel

A loja pode solicitar 30 ou 100 provas e acompanhar a confirmação.
O pagamento ocorre fora do app. Para habilitar a operação no painel,
insira em public.pilot_operators o UUID da conta confirmada do operador
(em user_id), usando o SQL Editor. Entre com essa conta, localize o pedido
pendente e registre a referência única do pagamento recebido. A confirmação
credita o saldo na mesma transação. A referência não pode ser reutilizada.
