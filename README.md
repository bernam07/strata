# Strata

<div align="center">

**Personal Wealth & Portfolio Intelligence Platform**

*A production-grade, ledger-backed financial operating system uniting equities, crypto, alternative assets, cashflow, and Apple Pay automation into a unified net-worth view.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20RLS%20%7C%20Edge%20Functions-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-190%2B%20Tests%20Passing-729b1b?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## Executive Summary

Strata is a private, full-stack fintech platform designed to solve the fragmentation of modern personal wealth tracking. Instead of relying on multiple disconnected apps (spreadsheets for net worth, broker apps for stocks, budgeting tools for expenses, separate collection trackers), Strata consolidates everything into a single ledger-derived system of record with real-time analytics, automated broker imports, alternative asset valuations, and contactless payment ingestion.

Published as an engineering portfolio piece and personal daily driver, it demonstrates high-integrity software design: **pure mathematical domain modelling**, **immutable ledger accounting**, **hardened PostgreSQL Row Level Security (RLS)**, and **real-world iOS ecosystem integrations**.

---

## Key Capabilities

### 1. Ledger-Derived Accounting & Net Worth
- **Single Source of Truth**: Balances, historical positions, and net worth are never statically stored; they are functionally derived from the transaction ledger via pure, tested functions (`deriveBalances`, `computeNetWorth`).
- **Debt by Sign, Not Separate Tables**: Assets and liabilities are dynamically classified by account type or balance sign (e.g., an overdrawn account or credit line automatically transitions into a liability without manual restructuring).
- **Exact Monetary Precision**: Financial math is executed with zero floating-point drift using `decimal.js` on the client and high-precision `numeric(19,4)` in PostgreSQL.

### 2. Investment Portfolio & Advanced Analytics
- **Performance Metrics**: Automated calculation of **XIRR** (Internal Rate of Return / Money-Weighted Return) and **TWR** (Time-Weighted Return) using historical cashflow sequences.
- **Position Tracking**: Weighted-average cost basis, unrealized P&L, daily gains, and portfolio asset allocation breakdowns.
- **Dividend Forecasting**: Forward dividend projections, ex-dividend calendar scheduling, and historical yield-on-cost metrics.
- **Crypto & Multi-Asset Support**: Real-time crypto tracking via CoinGecko and global equities pricing with foreign exchange (FX) conversion.

### 3. Alternative Assets & Collectibles Tracking
- **Pokémon TCG Market Valuation**: Live integration with TCGdex and ECB exchange rates to match **Collectr** app valuations (TCGplayer Market Price in USD converted to EUR). Includes variant finish selection (Normal, Reverse Holofoil, Holofoil, 1st Edition) and optional Cardmarket comparisons.
- **LEGO Sets & Minifigures**: Rebrickable catalog integration for quick lookup of sets, part counts, and release years, paired with live **BrickLink Price Guide** queries (6-month historical sales and current stock) via secure OAuth 1.0a Edge Functions.
- **Luxury & Tangible Assets**: Dedicated tracking for luxury watches, coins and bullion, wine, art, and custom asset classes.
- **Net Worth Inclusion Control**: One-click toggle allowing users to decide whether alternative assets contribute to their primary Dashboard Net Worth or remain isolated as a standalone speculative portfolio.

### 4. Apple Pay & Contactless Workflow (iOS Shortcuts)
- **Zero-Friction Logging**: Serverless webhook ingestion via Supabase Edge Functions allows instant transaction logging directly from iPhone/Apple Watch contactless taps.
- **Smart Merchant Intelligence**: Automatically matches recurring merchants (e.g., grocery stores, gas stations) to the user's preferred funding account (e.g., meal cards vs. personal checking) based on transaction history.
- **Pending Review Inbox**: Contactless payments land in an interactive review queue with 1-tap confirmation, account reassignment, and automatic category suggestions.

### 5. Automated Integrations & Vault Security
- **Trading 212 Synchronization**: Deno Edge Functions incrementally sync equity orders, dividends, and cash movements using the official Trading 212 API.
- **Rebrickable & BrickLink Credentials**: API keys and OAuth secrets are encrypted at rest using **Supabase Vault** (libsodium) and are never exposed to client bundles or browser storage.

### 6. Mobile Experience & Desktop UX
- **Design System**: Responsive interface with smooth bottom sheets, glassmorphic HUD headers, light/dark modes, and a privacy mode that blurs financial values.
- **Command Palette (`Cmd+K` / `Ctrl+K`)**: Rapid navigation, instant transaction creation, and keyboard-first actions.
- **iOS Home Screen Widget**: Token-authenticated Scriptable widget providing at-a-glance net worth and daily asset changes.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client (React 19 + TypeScript + Vite)"]
        UI["UI Layer\n(Neumorphic + Tailwind v4)"]
        State["State Management\n(TanStack Query v5)"]
        Core["Financial Core (Pure Logic)\n• XIRR / TWR Analytics\n• Ledger Balance Derivation\n• Dividend Projection Engine"]
    end

    subgraph Edge ["Supabase Edge Functions (Deno Runtime)"]
        T212Sync["t212-sync\n(Scheduled Portfolio Importer)"]
        MarketData["market\n(Yahoo & CoinGecko Feeds)"]
        BricklinkSync["bricklink-price\n(OAuth 1.0a Price Guide)"]
        WidgetHook["widget\n(Apple Pay Webhook & iOS Widget)"]
    end

    subgraph Data ["PostgreSQL Database (Supabase)"]
        Ledger[("transactions\n(Append-Only Ledger)")]
        Accounts[("accounts\n(Multi-Currency)")]
        CollectiblesTable[("collectibles\n(Portfolio & Valuations)")]
        Vault[("vault.secrets\n(Encrypted API Keys)")]
        Policies[("Row Level Security (RLS)\n• Tenant Isolation\n• SECURITY DEFINER RPCs")]
    end

    subgraph External ["External Services & Ecosystem"]
        T212API["Trading 212 API"]
        Yahoo["Yahoo Finance / CoinGecko"]
        TCGdex["TCGdex / ECB FX Rates"]
        BrickLink["BrickLink API (OAuth 1.0a)"]
        Rebrickable["Rebrickable API"]
        ApplePay["iOS Shortcuts / Apple Pay"]
    end

    ApplePay -->|Signed Webhook| WidgetHook
    T212API <-->|Encrypted Sync| T212Sync
    Yahoo <-->|Market Pricing| MarketData
    BrickLink <-->|Signed Request| BricklinkSync
    TCGdex <-->|Catalog & FX| Client
    Rebrickable <-->|Catalog Search| Client

    WidgetHook -->|Scoped Ingestion| Ledger
    T212Sync -->|Batch Ingest| Ledger
    T212Sync <-->|Read Credential| Vault
    BricklinkSync <-->|Read Credential| Vault
    MarketData -->|Upsert Prices| Data

    UI <--> State
    State <--> Core
    State <-->|Authenticated JWT + RLS| Data
```

---

## Security Architecture & Audit Report

Strata follows defense-in-depth principles designed for sensitive personal financial data:

| Security Vector | Implementation & Defensive Mechanism |
| :--- | :--- |
| **Row Level Security (RLS)** | Enabled across 100% of tables. Every query is filtered by `auth.uid() = user_id`. Composite foreign keys `(account_id, user_id)` guarantee transactional ownership integrity. |
| **Credential Encryption** | Broker keys and sensitive tokens (Trading 212, BrickLink OAuth, Rebrickable) are sealed inside PostgreSQL via `supabase_vault` using libsodium symmetric encryption. |
| **Search-Path Injection Defense** | All `SECURITY DEFINER` functions enforce `SET search_path = ''` and revoke execution rights from `public` to prevent path-hijacking vulnerabilities. |
| **Scoped Service Roles** | Unauthenticated callers cannot trigger Edge Function batch jobs. Ingestion endpoints strictly validate service-role keys for crons or verified JWTs for users. |
| **Webhook Protection** | Apple Pay and widget endpoints use high-entropy (48-character hex) random tokens with strict bounds checking (e.g., maximum amount caps, sanitized string lengths). |
| **Zero XSS Vectors** | No `dangerouslySetInnerHTML`, `eval()`, or unescaped HTML interpolation. All user inputs are strictly typed and sanitized before state commits. |

---

## Repository Structure

```
strata/
├── src/
│   ├── core/                  # Pure financial domain logic (Zero UI/DB dependencies)
│   │   ├── analytics/         # XIRR, TWR, cashflow series, monthly delta calculations
│   │   ├── balances/          # Pure balance derivation from transaction sequences
│   │   ├── dividends/         # Dividend yield and cash forecasting engine
│   │   ├── money/             # Arbitrary-precision decimal arithmetic (decimal.js)
│   │   ├── networth/          # Asset/liability classification and net worth math
│   │   └── positions/         # Portfolio position reconstruction & rebalancing logic
│   ├── features/              # Feature modules (Domain components, hooks, modals)
│   │   ├── accounts/          # Account management, targets, and payday allocations
│   │   ├── analytics/         # Wealth trajectory and performance charts
│   │   ├── collectibles/      # Alternative assets (Pokémon, LEGO, BrickLink, TCGdex)
│   │   ├── crypto/            # CoinGecko integration and crypto holdings
│   │   ├── dashboard/         # Financial timeline, pulse cards, and net worth donut
│   │   ├── dividends/         # Forward dividend schedule view
│   │   ├── expenses/          # Budget pacing, categories, and split expenses
│   │   ├── integrations/      # Trading 212, Rebrickable, BrickLink, and Apple Pay setup
│   │   ├── positions/         # Stock/ETF holdings, prices, and Yahoo symbol mapping
│   │   └── transactions/      # Transaction list, edit sheet, and pending review inbox
│   ├── db/                    # Supabase client, typed schemas, and row mappers
│   └── ui/                    # Design primitives, toasts, fields, and command palette
├── supabase/
│   ├── functions/             # Deno Edge Functions (market, t212-sync, widget, bricklink-price)
│   │   └── _shared/           # Shared modules (FX math, portfolio mapping, backoff)
│   └── migrations/            # Version-controlled SQL migrations & RLS policies
└── scripts/                   # Auxiliary CLI tools (VAPID generation, seeders)
```

---

## Testing & Verification

The core calculation engines and integration pipelines are backed by an extensive automated test suite run via [Vitest](https://vitest.dev/):

```bash
# Run unit and integration tests
npm test

# Run type-checking across TypeScript modules
npm run typecheck

# Build for production
npm run build
```

**Key test suites covered:**
- **Ledger Invariants**: Ensures transactions always correctly alter account balances and preserve debit/credit signs.
- **XIRR & TWR Math**: Verified against known Newton-Raphson convergence sets and standard financial benchmarks.
- **Payday Pacing & Budgets**: Edge-case testing for leap years, irregular month lengths, and multi-currency conversions.
- **Reconstruction Algorithms**: Validates that historical positions accurately reconstruct from sequence logs.
- **Collectibles & Valuation**: Tests for TCGplayer and Collectr EUR price resolution, variant finish fallbacks, and BrickLink price guide parsing.

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local Edge Functions)

### 1. Clone & Install
```bash
git clone https://github.com/bernam07/strata.git
cd strata
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Development Server
```bash
npm run dev
```

---

## License

This project is licensed under the [MIT License](./LICENSE).
