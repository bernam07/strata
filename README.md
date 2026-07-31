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
  features/      auth · accounts · transactions · dashboard
  ui/            primitivas neumórficas + tema claro/escuro
  app/           router, providers, shell
supabase/
  migrations/    schema versionado (RLS em todas as tabelas)
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
