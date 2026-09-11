# Strata

> Personal wealth tracker — investments and spending in one net-worth view.

Strata is a single-user personal finance app. It syncs a Trading&nbsp;212
portfolio, prices holdings and crypto from Yahoo Finance, and turns an
append-only transaction ledger into net worth, performance, and spending
insight.

Built and run by one person, for one person. The hosted instance is private —
every row lives behind per-user Postgres row-level security — and this repo
ships no credentials. It is published as a reference/portfolio piece, not as a
multi-tenant product.

## What it does

- **Net worth** — a live cross-section of everything owned and owed, derived
  entirely from the ledger. Assets and liabilities are bucketed by account type
  *or* by the sign of the balance, so an account that goes negative becomes a
  liability with no separate debt table.
- **Portfolio** — positions rebuilt from the ledger (weighted-average cost,
  cost basis, market value, unrealized P/L), plus allocation, sector breakdown,
  a rebalancing calculator, and time-/money-weighted returns (TWR & XIRR).
- **Trading 212 sync** — a Deno edge function imports orders, dividends and cash
  movements via the official API; the key is stored encrypted in Supabase Vault
  and never touches the browser or the repo.
- **Market data** — an independent edge function resolves each holding to a
  Yahoo symbol, refreshes prices and day changes, and powers search, a
  watchlist, price alerts, and optional web-push notifications.
- **Expenses** — hierarchical categories, monthly budgets, cash-flow, automatic
  recurring-subscription detection, and a monthly summary.
- **Crypto** — holdings priced in EUR, folded into net worth and the day's P/L.
- **Insight & quality-of-life** — automatic dashboard nudges, a command palette
  (⌘K), a privacy mode that blurs every amount, light/dark themes, JSON backup,
  a home-/lock-screen iPhone widget, and an installable PWA.

The financial history reconstructs real held quantities from the ledger and
daily net-worth snapshots, so performance and the "you vs. the market"
benchmark reflect what was actually held over time.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · Supabase (Postgres, Auth, RLS,
Deno edge functions) · TanStack Query · Vitest · Vercel.

## Architecture

The financial core lives in `src/core/` — pure, tested functions with no React
and no Supabase. Balances, net worth, positions, analytics, dividends, budgets
and insights are always *derived* from transactions, never stored.

```
src/
  core/       pure financial logic (money, balances, net worth, positions, analytics…)
  db/         Supabase client, generated types, mappers
  features/   auth · accounts · transactions · dashboard · positions · expenses · …
  ui/         neumorphic primitives, theming, toasts, command palette
  app/        router, providers, shell
supabase/
  migrations/ versioned schema — row-level security on every table
  functions/
    t212-sync/ Trading 212 importer (Deno)
    market/    Yahoo pricing, search, alerts, snapshots (Deno)
    widget/    token-scoped read-only endpoint for the iOS widget
    _shared/   shared, unit-tested pure logic
```

### Design decisions

- **Append-only ledger, single source of truth.** Balances and net worth are
  always derived. The append-only rule is enforced by RLS itself — `select` and
  `insert` policies, no `update`/`delete` on the ledger — so corrections are made
  with an adjustment transaction.
- **Liabilities by sign, not entity.** Bucketing uses the account `type` *or* the
  balance sign; nothing lives in a separate debts table.
- **Exact arithmetic.** `numeric` in Postgres, `decimal.js` on the client — never
  floating point for money.
- **Ownership integrity.** Transactions reference `(account_id, user_id)` via a
  composite foreign key, so a row can never point at another user's account.
- **Untrusted price writes stay server-side.** Prices, `current_price` and broker
  totals are written only by `security definer` RPCs restricted to the service
  role; the browser never writes them.

## Scripts

| Command             | Effect                          |
| ------------------- | ------------------------------- |
| `npm run dev`       | Development server              |
| `npm run build`     | Type-check + production build   |
| `npm run test`      | Unit tests (Vitest)             |
| `npm run typecheck` | Type-check only                 |

## License

[MIT](./LICENSE).
