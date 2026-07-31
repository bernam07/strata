# Strata

Gestão de património pessoal, camada a camada. Junta investimentos e despesas
no mesmo conceito de património líquido, com contexto fiscal português.

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
