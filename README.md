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
