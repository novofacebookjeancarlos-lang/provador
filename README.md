# Provador virtual

Next.js na Vercel, Supabase para login, catálogo, saldo e imagens de peças.
OpenAI Images Edits em qualidade low. Fotos de visitantes e resultados
são transitórios e retornam na própria requisição.

## Piloto

- /testar abre o teste com duas fotos e teto de 20 tentativas.
- /painel permite criar conta, confirmar e-mail, cadastrar loja, cadastrar
  uma foto por peça ou variante e copiar o link /testar?peca=UUID.
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

## Administração e lojas próprias

A página inicial fica em /, a demonstração em /testar e o painel global
em /admin. O painel global verifica pilot_operators no servidor e no banco.
Ele permite consultar saldo, suspender o provador e ajustar o limite diário.

Em loja própria, use o código gerado em “Instalar botão na vitrine”.
Associe os IDs das variantes no painel e atualize o atributo data-variante
do elemento provador-vitrine ao trocar a seleção. O widget abre o provador
no domínio da plataforma. Cada loja usa seu próprio ID, catálogo e saldo.

## Onde encontrar cada funcionalidade

- `app/painel`: tela do lojista, catálogo e recargas em componentes separados.
- `app/api/loja`: sessão, catálogo, recargas e administração. A rota autentica
  a requisição e delega à funcionalidade correspondente.
- `app/admin`: administração global. `app/testar` e `app/api/prova`: provador.
- `app/instalar`, `app/api/vitrine` e `public/provador.js`: instalação na vitrine.
- `supabase/migrations`: regras de dados, permissões e saldo.

## Marco 0 — configuração e testes

Use Node 22 ou superior. Para rodar o app, execute `npm ci`, copie
`.env.example` para `.env.local`, configure um Supabase de desenvolvimento
com as migrations e execute `npm run dev`. As variáveis abaixo aplicam-se
a Local, Preview e Production, com valores próprios de cada ambiente.

| Variável | Segredo | Valor |
|---|---|---|
| SUPABASE_URL | Não | URL do Supabase do ambiente |
| SUPABASE_SERVICE_ROLE_KEY | Sim | Chave do servidor do mesmo Supabase |
| OPENAI_API_KEY | Sim | Chave do projeto OpenAI do ambiente |
| OPENAI_IMAGE_MODEL | Não | gpt-image-2 |
| GARMENT_ASSET_HOST | Não | Opcional, apenas para imagens legadas externas |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Não | Site key do widget para os domínios do ambiente |
| TURNSTILE_SECRET_KEY | Sim | Secret key do mesmo widget |
| TRYON_IP_HASH_SECRET | Sim | Valor aleatório com pelo menos 32 caracteres, por ambiente |
| TRYON_IP_PER_MINUTE | Não | 5 |
| OPENAI_DAILY_BUDGET_MICRO_USD | Não | 5000000 (US$ 5,00) |
| OPENAI_ASSUMED_COST_MICRO_USD | Não | 70000 (US$ 0,07) |
| TRYON_BUDGET_ALERT_WEBHOOK_URL | Sim | Opcional. Endpoint HTTPS que aceita JSON. Sem ele, o alerta vai ao log estruturado |

Gere o segredo de IP com `openssl rand -hex 32`. Em Vercel, o limite usa
o IP fornecido pela plataforma. No desenvolvimento local todas as
requisições entram no mesmo balde. As chaves de teste da Cloudflare
servem apenas em Local/Preview. Production requer um widget real.

O orçamento reseta à meia-noite em America/Sao_Paulo. O app reserva
US$ 0,07 por chamada admitida e mantém a reserva mesmo com erro incerto.
Com US$ 5,00, admite até 71 chamadas, reserva US$ 4,97 e bloqueia a
72ª. O alerta cruza 80% na 58ª (US$ 4,06). Trata-se de um teto de
reservas estimadas, separado do limite efetivo na conta OpenAI.
A tabela de telemetria grava metadados e usage das tentativas admitidas.
Se a função for encerrada antes da finalização, a linha pode ficar sem
duração. O app não salva o conteúdo das fotos.

Execute `npm run test:sql` para subir um Postgres local descartável,
com diretório temporário e 32 conexões reais. O runner recusa URL externa.
Execute `npm run test:prova` para simular Supabase, Turnstile e OpenAI.
`npm run build` verifica a compilação.

### Preparar Supabase novo de Preview

Antes de rodar, confira no Dashboard que a referência é do projeto novo.
Abra o terminal na raiz do repositório. Obtenha a string de conexão no
Dashboard e informe a senha via prompt do psql ou .pgpass.

```sh
export PREVIEW_PROJECT_REF='PREENCHA_COM_O_REF_NOVO'
export PREVIEW_DB_URL='postgresql://postgres@db.PREENCHA_COM_O_REF_NOVO.supabase.co:5432/postgres?sslmode=require'
test "$PREVIEW_PROJECT_REF" != qislunvynxdrbclzqaoy &&
  test "$PREVIEW_DB_URL" = "postgresql://postgres@db.$PREVIEW_PROJECT_REF.supabase.co:5432/postgres?sslmode=require" &&
  test "$PREVIEW_PROJECT_REF" != PREENCHA_COM_O_REF_NOVO || exit 1
npx supabase link --project-ref "$PREVIEW_PROJECT_REF"
npx supabase db push --linked --dry-run
npx supabase db push --linked
psql "$PREVIEW_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into public.pilot_stores(id,name,generation_budget) values
 ('11111111-1111-4111-8111-111111111111','Loja Preview',2)
 on conflict (id) do nothing;
insert into public.pilot_pieces(id,store_id,name,garment_url,image_key,enabled,external_variant_id) values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Variante A','','preview/variante-a.jpg',true,'preview-a'),
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Variante B','','preview/variante-b.jpg',true,'preview-b')
 on conflict (id) do nothing;
select 20 - count(*) as demo_tentativas_restantes from public.demo_tryon_attempts;
commit;
SQL
```

Envie dois JPEGs de teste pelo Dashboard do Storage, bucket privado
`provador-produtos`, pasta `preview`, com os nomes acima. Em banco novo,
a demo já tem 20 tentativas globais disponíveis. O seed da loja não
precisa de conta Auth para testar o link público. Para testar o painel,
cadastre e confirme uma conta de Preview e associe o UUID em owner_id.

### Deploy com rastreabilidade

Conecte o repositório em Vercel → projeto Provador → Settings → Git e
configure `main` como branch de produção. Até a conexão funcionar, rode
na branch com checkout limpo:

```sh
test -z "$(git status --porcelain)" || exit 1
vercel deploy --meta "sourceCommitSha=$(git rev-parse HEAD)"
```

Confira o deployment em Deployments e o metadado pela API do deployment
ou `vercel list --meta "sourceCommitSha=<SHA>"`. O comando acima cria
Preview. Rode o smoke test no Preview antes de qualquer promoção.
