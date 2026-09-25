# Strata — engineering guide

Personal, single-user wealth-management PWA. One person (the owner) is the only
user; there is no multi-tenancy beyond the row-level security that enforces it,
and no onboarding flow for strangers. Optimise for the owner's daily use on an
iPhone in dark mode, not for a general audience.

This file is the working brief for anyone — human or model — picking the project
up cold. It describes what is actually in the repository, the invariants that
must not be broken, and the traps that have already cost debugging time.

---

## 1. Stack and commands

| | |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind v4, React Router 6 |
| Data layer | TanStack Query v5 |
| Money | `decimal.js` (never floats — see §6) |
| Backend | Supabase: Postgres + Auth + RLS + Deno edge functions |
| Hosting | Vercel (SPA rewrite in `vercel.json`) |
| Mobile / Android | Capacitor 8 (native Android project in `android/`) |
| Tests | Vitest + Testing Library + jsdom |

```bash
npm run dev         # Vite dev server
npm run build       # tsc -b && vite build   ← the real gate; TS is strict
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run
npx vitest run      # same, used throughout CI
npm run cap:sync    # build web assets and sync with native Android project
npm run cap:open    # open the android/ project in Android Studio
```

`npm run build` runs `tsc -b` first and the project has `noUnusedLocals`
enabled, so an unused import is a **build failure**, not a warning. Always build
before committing.

### Type-checking the edge functions

The functions are Deno, not Node, and are **not** covered by `npm run build`.
CI runs `deno check` on all four. Locally, Deno needs an import map because the
functions import Supabase from `esm.sh` while the local cache resolves npm:

```bash
# /tmp/check-map.json
{ "imports": { "https://esm.sh/@supabase/supabase-js@2": "npm:@supabase/supabase-js@2" } }

deno check --import-map=/tmp/check-map.json --node-modules-dir=auto \
  supabase/functions/market/index.ts
```

Without `--node-modules-dir=auto` newer Deno versions fail with
"Could not find @supabase/supabase-js in node_modules".

### Environment

`.env` (copy `.env.example`):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=      # optional, Web Push for price alerts
```

Never commit `.env`. The VAPID **private** key lives only in the `market`
function's Supabase secrets. `scripts/generate-vapid.mjs` generates a pair.

---

## 2. Repository layout

```
src/
  core/        Pure domain logic. No React, no network, no Supabase. Fully unit-tested.
  features/    One folder per feature; `api/` holds its TanStack Query hooks.
  ui/          Design-system primitives. Feature-agnostic.
  app/         Shell, router, icons, providers, cross-cutting hooks.
  db/          Supabase client, hand-maintained types, row mappers.
supabase/
  migrations/  Numbered, append-only. Never edit a migration that has shipped.
  functions/   Deno edge functions + `_shared/` modules.
scripts/       One-off maintenance scripts.
```

**The `core` / `features` split is the load-bearing architectural rule.**
Anything that can be expressed as a pure function of data belongs in `core` with
a unit test beside it. `features` wires `core` to React and Supabase. If you find
yourself testing a React component to verify a calculation, the calculation is in
the wrong layer.

---

## 3. Data model

24 tables. Every user-owned table follows the same pattern:

```sql
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
-- RLS enabled, policies: using ((select auth.uid()) = user_id)
```

Core tables: `accounts`, `transactions`, `instruments`, `holdings`, `prices`,
`fx_rates`, `broker_accounts`, `categories`, `transaction_categories`, `budgets`,
`net_worth_snapshots`, `crypto_holdings`, `price_alerts`, `push_subscriptions`,
`recurring_transactions`, `watchlist`, `allocation_targets`, `instrument_notes`,
`user_preferences`, `provider_credentials`, `sync_state`, `sync_runs`,
`widget_tokens`, `institutions` (the only non-user-scoped table).

### The ledger is append-only, with one exception

`transactions` has `select` and `insert` policies for everything. Migration 0008
added `update`/`delete` policies scoped to **manual rows only** — anything
imported by a sync is immutable. The UI mirrors this: `TransactionList` only
offers edit/reverse/delete when `source === 'manual' && transferGroupId === null`.
To undo a synced entry the user posts a **reversal**, which keeps the original in
the ledger.

### Security-definer RPCs

Ten migrations define `security definer` functions. The grant pattern matters:

- **`to service_role`** — callable only by an edge function holding the service
  key: `ingest_transactions`, `replace_holdings`, `upsert_prices`,
  `upsert_fx_rates`, `upsert_broker_cash`, `set_broker_total`,
  `set_instrument_yahoo`, `set_instrument_sector`, `provider_secret`.
- **`to authenticated`** — callable from the browser: `reset_t212_sync`,
  `clear_sync_history`, `create_widget_token`, `set_t212_api_key`,
  `remove_t212_api_key`, `set_instrument_yahoo_mine`.

`set_instrument_yahoo_mine` exists specifically because the client needs to
override a symbol but `set_instrument_yahoo` is service-role only; the `_mine`
variant re-checks `user_id = auth.uid()` inside the function.

Every one is `revoke execute ... from public` before the grant. Keep that.

### `src/db/database.types.ts` is hand-maintained

It is **not** regenerated from the database. When you add a column or an RPC you
must edit this file by hand or the typed Supabase client will reject the query
(`TS2345`, or "column not found in type"). This has bitten twice. Columns added
recently: `categories.color`, `crypto_holdings.coin_id`, `crypto_holdings.image_url`.

### Migrations that may not be applied yet

Migrations are applied manually against the Supabase project. If a page throws on
a missing column, check these first:

- `0024_category_color.sql` — `categories.color`
- `0025_crypto_coingecko.sql` — `crypto_holdings.coin_id`, `image_url`

---

## 4. Edge functions

### `market` — the busiest one

Actions, dispatched on `params.action` (default `refresh`):

| action | purpose |
|---|---|
| `refresh` | Update all holdings' prices, then crypto, then evaluate alerts |
| `quote` | One instrument's price + history (by symbol, or ISIN/ticker/yahoo) |
| `quotes` | Batch mini-quotes by symbol |
| `search` | Yahoo instrument search |
| `profile` | Reference data + key dates for an instrument (quoteSummary) |
| `crypto-search` | CoinGecko coin search |
| `crypto-markets` | CoinGecko prices by coin slug |
| `backfill` | Reconstruct historical net-worth snapshots from the ledger |

**Caller scoping.** `callerScope()` distinguishes the service-role key (cron →
refresh everyone) from a user JWT (scope to that user). A browser can never
trigger a global fan-out. Preserve this when adding actions.

**Yahoo needs a cookie + crumb.** `getAuth()` seeds a cookie from `fc.yahoo.com`
then fetches a crumb. `yFetch` retries 429/503 with backoff and re-authenticates
once on 401/403. Use `yFetch`, never bare `fetch`, for Yahoo.

**Bounded concurrency.** `mapLimit(items, limit, fn)` — use it instead of
`Promise.all` over a symbol list, or Yahoo rate-limits.

### `t212-sync`

Pulls portfolio, cash, orders, dividends and cash transactions from Trading 212.
Paginated streams resume from a watermark in `sync_state`.

**The pagination trap (already fixed — do not regress).** T212's
`/history/transactions` requires `cursorId` *and* `time` together and rejects one
without the other. An earlier implementation extracted a bare cursor and lost the
time, producing `400 Both or none of cursorId and time must be provided`. The fix
is to follow `body.nextPagePath` **verbatim**, prefixing the origin when it starts
with `/`. Watermarks that are a bare cursor (no leading `/`) are ignored and the
stream restarts — ingestion is idempotent, so that is safe.

### `widget`

Serves a token-authenticated JSON snapshot for the iOS Scriptable widget.
Tokens come from `create_widget_token`.

### `advisor`

Answers questions about user finances using Google Gemini (`gemini-3.8-flash`).
Loads consolidated context (accounts, enriched holdings with tickers/names, crypto holdings,
budgets, categorized transactions, net-worth snapshots, and broker totals).
Caller is authenticated via user JWT. Requires `GEMINI_API_KEY` in Supabase function secrets
(optional `GEMINI_MODEL`).

---

## 5. External integrations

| Service | Used for | Notes |
|---|---|---|
| Google Gemini | Financial Advisor (`advisor` edge function) | Key in function secrets (`GEMINI_API_KEY`), model `gemini-3.8-flash` |
| Trading 212 | Holdings, cash, transaction history | User's API key, stored via `set_t212_api_key` |
| Yahoo Finance | Stock/ETF prices, search, history, profile | Unofficial; cookie+crumb; flaky |
| CoinGecko | Crypto search and prices | Free tier, no key, rate-limited per minute |
| Frankfurter | FX rates (ECB daily) | Only non-EUR instruments need it |
| Web Push (VAPID) | Price alerts | Private key in function secrets |

### Crypto is CoinGecko, not Yahoo

Yahoo only quotes crypto as **trading pairs** (`BTC-EUR`, `BTC-USD`), so search
filled with duplicates of the same coin and thinner coins were missing entirely.
CoinGecko identifies a coin by **slug** (`bitcoin`, `ondo-finance`) and prices
directly in EUR, so there is no pair to choose and no second FX conversion.

- `crypto_holdings.coin_id` holds the slug and is what we price against.
- `symbol` is display-only (`BTC`), `image_url` caches the logo.
- Holdings created before the switch have no slug; `refreshCrypto` resolves one
  from the ticker on first run and stores it, so they self-heal.
- The schema stores `previous_close` and derives the day change from it, while
  CoinGecko reports a 24h percentage — converted back on write
  (`closeFromChange`) so nothing downstream changed.

---

## 6. Invariants

**Money is `decimal.js`, never a float.** `src/core/money/money.ts` configures
34-digit precision, half-even rounding, and exports `Money = Decimal` plus
helpers. Amounts cross the wire as **strings** and are parsed with `money()`.
Never do arithmetic on `Number(row.amount)` for anything the user sees as a
balance. (Chart geometry and percentages are fine as numbers.)

**Everything is reported in EUR.** Non-EUR instruments convert through
`fx_rates`. Historical FX is not stored — the backfill uses the latest rate and
says so in a comment; that approximation is deliberate and acknowledged.

**Broker account total has two sources of truth, deliberately reconciled.**
Trading 212's `cash.total` is authoritative and set by the sync. The Yahoo price
refresh recomputes `free + Σ(holdings)` and overwrites it **only when every
holding priced cleanly this run** (`entry.stale === 0`). If any quote failed, the
last authoritative value is kept rather than being replaced by a partial estimate
that silently drifts from the T212 app. The refresh returns a `stale` count and
the Portfolio page surfaces it. Do not remove that guard.

---

## 7. Design system

A dark-first neumorphic language, informally "Onyx": warm near-black grounds and
a single gold accent.

### Tokens (`src/index.css`)

```
--bg #0a0908        --surface-raised #151311   --surface-flat #1c1a17
--surface-sunken #0f0e0d   --line #2a2723
--text-strong #f4f1ea      --text-2 #b6b2aa     --text-muted #7c786f
--accent #e0a44a (gold)    --positive #57cb92   --negative #ef6b78
--radius-card 16px  --radius-field 11px  --radius-pill 999px
```

Light theme is defined too and must keep working — never hardcode a colour that
only reads on one ground. Utilities: `neu-raised`, `neu-flat`, `neu-sunken`,
`tap`, `page-enter`.

`index.html`'s `theme-color` must track `--bg`. It has drifted once already.

### Primitives — use these, do not re-roll them

| Component | Use |
|---|---|
| `PageHero` | **The opening block of every main page**: eyebrow label, one large figure, optional change chip, slots for controls above and a chart below |
| `Amount` | Large figure with the euro sign as a superscript (`md`/`lg`/`xl`) |
| `AmountInline` | Row-scale amount, trailing €, inherits colour |
| `DeltaPill` | Change chip; **tone is an explicit prop** because a rise in spending is bad and a rise in net worth is good |
| `Stat` | A single figure in the category-tile language |
| `SegmentedControl` | Every range / tab / toggle strip |
| `SectionTitle` | Heading for a section outside a card |
| `CardTitle` / `headingClass` (`ui/Heading`) | Heading inside a card; matches what `Collapsible` draws |
| `Collapsible`, `Card`, `Surface`, `Button`, `Field`, `Skeleton`, `Toaster` | As named |

There is **one** heading treatment (small, bold, uppercase, `tracking-[0.12em]`,
muted) and **one** segmented control. Both were previously duplicated across six
to twelve files; that was consolidated. Do not reintroduce a variant.

### Theme-safe tinting

Category colours mix a hue into the surface token rather than being used flat:

```ts
background: `color-mix(in srgb, ${color} 13%, var(--surface-flat))`
```

This renders as a deep tint in dark mode and a soft pastel in light mode from one
definition. `src/features/expenses/categoryColors.ts` is the single source; a
category with `color === null` renders neutral, which is the **default** — colour
only appears where the user deliberately set it.

Category colour values are constrained to a 6-digit hex **at the database
boundary** (`categories_color_hex` check), because the value is interpolated into
a CSS colour. Keep that constraint if you add a colour field anywhere else.

---

## 8. Traps that have already cost time

**Percentage-height chains break charts.** The dividends chart sized its bars
through `height: X%` across three nested flex parents. It rendered fine until it
was moved into a new wrapper, then collapsed to nothing. Charts now compute
**pixel** heights from a fixed plot height (`DividendsBarChart`, `SpendOverview`).
Do not reintroduce a percentage-height chain.

**iOS: the tab bar must stay `position: fixed`.** A fixed element's containing
block is the viewport, which with `viewport-fit=cover` reaches the *physical*
bottom of the screen. `bottom-0` plus `pb-[env(safe-area-inset-bottom)]` is what
makes the bar's background cover the home indicator.

An attempt to lay the bar out **in the flow** at the bottom of a `fixed inset-0`
shell — to stop it drifting after the keyboard closes — made things strictly
worse: the bar then ends where the *shell* ends, which does not reach under the
home indicator, so the black strip became **permanent** instead of intermittent.
That change is reverted. Do not try it again.

Resolved via `src/app/useViewportHeal.ts`: in iOS standalone PWAs, opening the
software keyboard shrinks `window.innerHeight` / `100dvh` and WebKit fails to
restore the viewport height after keyboard dismissal, leaving a ~59px black strip
until force-quit. Toggling `display: none -> ''` with a synchronous reflow
(`void shell.offsetHeight`) on the `100dvh` `#app-shell` after input blur /
keyboard dismissal forces WebKit to re-measure the UIWindow and snap back to full
height.

`html` paints `--bg` (not just `body`) so any sliver the viewport exposes is
app-coloured rather than the system's black. That part is additive and stays.

**PWA scroll.** Only `<main>` scrolls (`overflow-y-auto overscroll-contain`).
`html, body` carry `overscroll-behavior: none`. The header sits outside the
scroll region so it cannot rubber-band.

**`AmountInline` and negative numbers.** Without `signed` it shows a minus for
negatives and no plus for positives; with `signed` it shows both. An early
version formatted the absolute value unconditionally and silently dropped the
minus on negative cash-flow figures. Check this when touching it.

**Drag vs click on interactive charts.** `SpendOverview` supports both tapping a
bar and dragging across bars. A drag sets a flag that swallows the `click` which
follows `pointerup`, otherwise the scrub toggles off the bar it lands on.

**Yahoo's shape.** `quoteSummary` wraps every figure as `{raw, fmt, longFmt}` and
returns dates as epoch seconds. Both are unwrapped at the edge (`rawNumber`,
`rawDate`) so the client never deals with it.

**Instrument symbol overrides.** Yahoo's ISIN→symbol match sometimes picks the
wrong listing (Oracle resolved to a listing ~€40 off across the position). The
instrument detail page has a "Price source" control writing
`set_instrument_yahoo_mine`. If a single holding's value looks wrong, check this
before suspecting the maths.

---

## 9. Testing

32 test files, 140 tests, all in `core` plus a handful of component tests.
Convention: `foo.ts` + `foo.test.ts` side by side. `src/test/setup.ts` wires
jest-dom.

New domain logic gets a unit test. UI work generally does not, which is a
deliberate trade-off — but it means **layout regressions are invisible to CI**.
Visual changes must be checked on a real device; the build passing proves
nothing about how a page looks.

---

## 10. Deployment

- **Frontend** → Vercel. `vercel.json` rewrites all paths to `/index.html` and
  sets immutable caching for `/assets/*`, no-cache for everything else.
- **Edge functions** → GitHub Actions (`deploy-functions.yml`) on push to `main`
  touching `supabase/functions/**`. Needs `SUPABASE_ACCESS_TOKEN` and
  `SUPABASE_PROJECT_ID` secrets.
- **CI** (`ci.yml`) on `main`/`dev`: build + vitest, and `deno check` on all
  three functions.
- **Migrations are applied manually.** There is no migration runner in CI.
- **Price refresh cron** is defined in migrations 0021/0022.

The repository is public. Keep it clean: no secrets, no dumps, no scratch files.

---

## 11. Known limitations

- Historical FX is not stored; backfilled snapshots use today's rate.
- Yahoo is unofficial and irregular — ETFs and some European listings return
  empty P/E, earnings and dividend fields, so `InstrumentFacts` renders only what
  exists and hides itself when nothing does.
- CoinGecko's free tier rate-limits per minute; `cgFetch` backs off, but a burst
  of refreshes can still come back short.
- Crypto **quantities** are entered by hand. There is no exchange or wallet sync;
  the coins are held on-chain, so automating this would mean tracking addresses
  per blockchain.
- The service worker update prompt lives in `src/app/useAppUpdate.ts`.
- An intermittent black strip below the tab bar on iOS after typing or
  interacting is **unresolved** — see §8. One attempted fix regressed it to a
  permanent strip and was reverted.

---

## 12. Conventions

- Comments explain **why**, not what. Match the density of the surrounding file.
- Prefer editing an existing primitive over adding a parallel one.
- `usePersistentState(key, initial)` for localStorage-backed UI state. Prune keys
  in `src/main.tsx` when a feature is removed.
- Query keys are arrays declared next to their hook (`cryptoKey`,
  `categoriesKey`, …). When a mutation changes data another feature reads,
  invalidate that feature's key too — `useRefreshPrices` invalidates positions,
  broker accounts, instrument prices, net-worth history **and** crypto.
- Work happens on feature branches; `main` is deployed.
