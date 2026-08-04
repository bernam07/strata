# Strata

Gestão de património pessoal, camada a camada. Junta investimentos e despesas
no mesmo conceito de património líquido.

Single-user na prática, multi-user na arquitetura (RLS desde a primeira
migração).

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · Supabase (Postgres, Auth, RLS) ·
TanStack Query · Recharts · Vitest · Vercel.

## Estado — Fase 1

Fatia vertical mínima:

- Autenticação (email + palavra-passe)
- Criação de contas com seleção de instituição (logótipos locais + fallback
  para monograma)
- Inserção manual de transações
- Listagem com filtros por conta e por período
- Saldo por conta e património líquido no dashboard, com contas negativas a
  contarem automaticamente como passivo

**Critério de aceitação:** criar uma conta Revolut, adicionar 100 €, adicionar
uma despesa de 30 €, ver 70 €. Levar a conta a negativo e vê-la no bloco de
passivos. Coberto por testes em `src/core`.

## Estado — Fase 2

Integração Trading 212:

- Edge Function `t212-sync` (Deno) que importa ordens, dividendos e movimentos
  de caixa através da API oficial (`live` ou `demo`)
- Chave da API guardada cifrada no Supabase Vault, definida por RPC — nunca no
  browser, nunca em texto simples, nunca no repositório
- Backoff exponencial que respeita o `Retry-After` e cursor persistido por
  stream para não reprocessar o histórico completo
- Normalização dos tickers `AAPL_US_EQ` e mapeamento para ISIN numa tabela de
  instrumentos persistida
- Todas as escritas via `on conflict do nothing` na constraint de unicidade
- Estado da sincronização (última execução, sucesso/falha, mensagem de erro)
  visível no separador **Integrações**

Lógica pura (normalização, backoff, cursor, mapeamento) coberta por testes em
`supabase/functions/_shared/t212`.

### Ligar o Trading 212

1. Aplicar a migração `0002_phase2_trading212.sql` (`supabase db push`).
2. Publicar a função: `supabase functions deploy t212-sync`.
3. Na app, separador **Integrações**, colar a chave da API (usa o ambiente de
   demonstração durante o desenvolvimento).
4. Criar uma conta com a instituição Trading 212.
5. `Sincronizar agora`, ou deixar o agendamento correr.

## Estado — Fase 3

Posições e dividendos:

- Posições agregadas derivadas do livro-razão (custo médio ponderado, base de
  custo, valor de mercado e mais-valia latente), com preços e câmbios a serem
  a única entrada externa
- Snapshot de preços do portefólio Trading 212 e câmbios diários (ECB via
  frankfurter, sem chave) guardados em tabelas próprias com histórico
- Separador de dividendos com duas vistas: histórico recebido e calendário
  projetado a partir da periodicidade histórica (mensal/trimestral/etc.), com
  os valores estimados visualmente distintos (opacidade, traço interrompido,
  etiqueta)

Custo médio e projeção de dividendos cobertos por testes em `src/core`.

## Estado — Fase 4

Análise, calculada a pedido a partir do livro-razão (sem tabela de snapshots):

- Evolução do património ao longo do tempo, com seletor de período
- Rendimento ponderado pelo tempo (TWR), encadeando retornos por sub-período
- Rendimento ponderado pelo dinheiro (XIRR), por Newton-Raphson com bisseção de
  recurso quando não converge
- Repartição por ano civil
- Diversificação por geografia (prefixo ISIN) e moeda

TWR e XIRR têm testes unitários com casos de valor conhecido, e a construção dos
inputs a partir do livro-razão também é testada. O gráfico do Recharts é
carregado em lazy num chunk próprio.

> Nota: a série usa custo de aquisição; performance de mercado histórica torna-se
> exata à medida que os snapshots diários de preços acumulam. Setor e classe de
> ativo ficam pendentes de metadados de instrumento mais ricos.

## Estado — Fase 5

Despesas:

- Categorias hierárquicas (raiz e subcategoria), categorização de transações
  numa tabela lateral que preserva o append-only das transações
- Resumo mensal de despesas por categoria e comparação mês vs. mês anterior

Resumo de despesas coberto por testes em `src/core`.

### Agendamento

A função corre para todos os utilizadores com chave configurada quando é
invocada com a chave de serviço. Exemplo com `pg_cron` + `pg_net` (substituir
`<PROJECT_REF>` e guardar a chave de serviço no Vault, nunca em texto simples):

```sql
select cron.schedule(
  't212-sync-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/t212-sync',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                      where name = 'service_role_key')
      )
    );
  $$
);
```

## Estado — Orçamentos, previsão e movers

- **Orçamentos por categoria** (migração `0011_budgets.sql`, RLS): limite
  mensal por categoria, com barra de progresso, restante e aviso quando passa
  do limite. O gasto é o do mês corrente, por categoria atribuída.
- **Previsão de dividendos**: rendimento estimado a 12 meses distribuído por
  mês, yield-on-cost global e rendimento anual projetado por posição (base de
  custo vinda das posições).
- **Dashboard vivo**: evolução do património com seletor de período
  (1M/6M/1A/tudo) e variação no período, mais um bloco de _movers_ (líderes e
  atrasados) por mais-valia latente, com atalho para cada ativo.

Lógica de orçamentos e de previsão coberta por testes em `src/core`.

## Estado — Evolução real, metas e utilidades

- **Evolução a valor de mercado** (migração `0012`): tabela
  `net_worth_snapshots` (RLS) com um registo por dia; o dashboard grava o
  snapshot de hoje e passa a desenhar a série real (não o custo de aquisição)
  assim que houver histórico.
- **Variação do dia**: o refresh guarda o `previous_close` de cada posição, e
  a app mostra o P/L de hoje no cartão de património, _movers_ "a subir/descer
  hoje" e a variação diária na página do ativo.
- **Meta de património** (migração `0013`, tabela `user_preferences`): define
  um alvo e vê a barra de progresso no dashboard.
- **Despesas recorrentes**: deteção de subscrições (mesma nota, cadência
  regular) com custo mensal estimado.
- **Exportar transações em CSV**, **atualizar preços manualmente** nas
  posições, **preços na pesquisa/watchlist**, período e range do gráfico
  memorizados, e rotas carregadas em lazy para arrancar mais depressa.
- **Notas por posição** (migração `0016`) e **alocação** da carteira nas
  posições.
- **Fluxo de caixa** mensal (entradas vs. saídas) nas despesas,
  **rebalanceamento** com alvos por ativo e desvio sugerido (migração
  `0017`), e valores em **moeda nativa** na página do ativo.
- **Alocação por setor** (migração `0018`): o refresh guarda o setor de cada
  ação (Yahoo `assetProfile`) e as posições mostram a repartição por setor.

- **Alertas de preço** (migração `0014`, tabela `price_alerts`): define alvos
  "acima/abaixo" num ativo; a app avalia contra a cotação atual, marca como
  disparado e mostra um aviso no dashboard e na pesquisa. Sem push por agora —
  avaliação in-app.
- **Resiliência do Yahoo**: a função `market` faz backoff exponencial em
  `429`/`503` e volta a autenticar em `401`/`403`.

### Notificações push (opcional)

Os alertas também podem chegar como notificação push (Web Push), mesmo com a
app fechada — avaliados no cron pela função `market`.

1. Gerar as chaves VAPID: `deno run scripts/generate-vapid.ts`.
2. No projeto Supabase, definir os _secrets_ da função `market`: `VAPID_KEYS`
   (o JSON impresso) e `VAPID_SUBJECT` (um `mailto:`).
3. No frontend (Vercel), definir `VITE_VAPID_PUBLIC_KEY` com a chave pública.
4. Na app, **Integrations → Price alert notifications → Enable** (é preciso a
   PWA no ecrã inicial no iOS).

Sem estas chaves, o envio de push fica desativado sem afetar o resto — a
avaliação in-app dos alertas continua a funcionar. O `service worker`
(`public/sw.js`) só trata de push, não faz cache, por isso não interfere com a
atualização da PWA.

Lógica de despesas recorrentes, exportação e alertas coberta por testes em
`src/core`.

## Estado — Cotações e pesquisa

Preços de mercado independentes da sincronização de trades:

- Edge Function `market` (Deno) com três ações:
  - `refresh` (agendada) — resolve o símbolo Yahoo de cada instrumento detido
    (por ISIN, guardado em cache em `instruments.yahoo_symbol`), busca a cotação,
    atualiza `holdings.current_price`, acumula o histórico em `prices` e recalcula
    `broker_accounts.total` (caixa livre + Σ quantidade × preço × câmbio)
  - `search` — pesquisa de ações e ETF por nome ou ticker
  - `quote` — cotação atual, variação do dia e histórico de um ano
- Separador **Search**: pesquisar e ver qualquer ação/ETF, mesmo sem a deter,
  com gráfico de preço e lista de seguimento (`watchlist`, com RLS)

O valor dos stocks passa a atualizar sozinho pelo agendamento; o `Sincronizar
agora` do Trading 212 fica reservado para importar novas ordens e quantidades.

> Fonte de cotações: Yahoo Finance (sem chave). A escrita dos preços, do
> `current_price` e do `total` do broker é feita por RPCs `security definer`
> restritas ao `service_role` — o browser nunca escreve estes valores.

### Agendamento das cotações

Aplicar a migração `0010_market_data.sql` e publicar a função
(`supabase functions deploy market`). Depois agendar o `refresh` (a chamada leva
a chave de serviço, que satisfaz o `verify_jwt`):

```sql
select cron.schedule(
  'market-refresh',
  '*/30 9-22 * * 1-5',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/market',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                      where name = 'service_role_key')
      ),
      body := jsonb_build_object('action', 'refresh')
    );
  $$
);
```

O intervalo `*/30 9-22 * * 1-5` corre de meia em meia hora, nas horas úteis de
dias de semana; ajustar à conveniência.

## Arranque

```bash
npm install
cp .env.example .env      # preencher com o projeto Supabase
npm run dev
```

Aplicar o schema num projeto Supabase:

```bash
supabase db push          # aplica supabase/migrations/0001_phase1_init.sql
```

## Scripts

| Comando             | Efeito                        |
| ------------------- | ----------------------------- |
| `npm run dev`       | Servidor de desenvolvimento   |
| `npm run build`     | Typecheck + build de produção |
| `npm run test`      | Testes (Vitest)               |
| `npm run typecheck` | Só verificação de tipos       |

## Arquitetura

O núcleo financeiro vive em `src/core/` — funções puras, sem React nem
Supabase, cobertas por testes. Tudo o que é saldo, património líquido ou
convenção de sinais é derivado das transações, nunca guardado.

```
src/
  core/          lógica financeira pura (money, balances, networth, kinds)
  db/            cliente Supabase, tipos, mappers
  features/      auth · accounts · transactions · dashboard · integrations
  ui/            primitivas neumórficas + tema claro/escuro
  app/           router, providers, shell
supabase/
  migrations/    schema versionado (RLS em todas as tabelas)
  functions/
    t212-sync/   Edge Function de sincronização (Deno)
    market/      Edge Function de cotações e pesquisa (Yahoo)
    widget/      endpoint com token para o widget iOS (só investimentos)
    _shared/     lógica pura T212, partilhada e testada
```

### Decisões deliberadas

- **Transações append-only, fonte de verdade única.** Saldos e património são
  sempre derivados. O append-only é imposto pela própria RLS: existem políticas
  de `select` e `insert`, nenhuma de `update`/`delete`. Correções fazem-se com
  uma transação de ajuste.
- **Passivo por sinal, não por entidade.** O bucketing usa o `type` da conta
  **ou** o sinal do saldo — uma conta que desce a negativo passa a passivo sem
  tabela separada de dívidas.
- **Aritmética exata.** `numeric` no Postgres, `decimal.js` no cliente. Nunca
  vírgula flutuante para dinheiro.
- **Integridade de posse.** As transações referenciam `(account_id, user_id)`
  por chave estrangeira composta — uma transação não pode apontar para a conta
  de outro utilizador.
