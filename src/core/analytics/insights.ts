import type { Transaction, TransactionKind } from '../types';

export interface Insight {
  id: string;
  tone: 'positive' | 'negative' | 'neutral';
  text: string;
}

export interface InsightInput {
  now: Date;
  transactions: readonly Transaction[];
  cash: number;
  investments: number;
  fmt: (value: number) => string;
  categoryOf?: (transactionId: string) => string;
}

const monthKey = (year: number, month: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

// Month key `back` whole months before `now` (UTC), with year rollover.
const shift = (now: Date, back: number): string => {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return monthKey(date.getUTCFullYear(), date.getUTCMonth());
};

const sumKinds = (
  transactions: readonly Transaction[],
  key: string,
  kinds: readonly TransactionKind[],
): number =>
  transactions
    .filter((t) => kinds.includes(t.kind) && t.occurredAt.startsWith(key))
    .reduce((total, t) => total + Number(t.amount), 0);

const pct = (value: number): string => `${Math.round(Math.abs(value) * 100)}%`;

// Turns the ledger and a couple of totals into a short list of plain-language
// nudges. Pure and deterministic given its inputs, so it is unit-testable.
export const buildInsights = (input: InsightInput): Insight[] => {
  const { now, transactions, cash, investments, fmt, categoryOf } = input;
  const out: Insight[] = [];

  const thisKey = shift(now, 0);
  const lastKey = shift(now, 1);

  const spend = (key: string) => -sumKinds(transactions, key, ['expense', 'fee']);
  const income = (key: string) => sumKinds(transactions, key, ['income']);
  const dividends = (key: string) =>
    sumKinds(transactions, key, ['dividend', 'interest']);

  // Saved / overspent so far this month.
  const savedThis = income(thisKey) + dividends(thisKey) - spend(thisKey);
  if (income(thisKey) > 0 || spend(thisKey) > 0) {
    out.push(
      savedThis >= 0
        ? { id: 'saved', tone: 'positive', text: `You've saved ${fmt(savedThis)} so far this month.` }
        : { id: 'saved', tone: 'negative', text: `You're ${fmt(-savedThis)} in the red this month.` },
    );
  }

  // Last full month's spend vs the 3 months before it.
  const lastSpend = spend(lastKey);
  const priorAvg =
    (spend(shift(now, 2)) + spend(shift(now, 3)) + spend(shift(now, 4))) / 3;
  if (priorAvg > 0 && lastSpend > 0) {
    const delta = (lastSpend - priorAvg) / priorAvg;
    if (Math.abs(delta) >= 0.15) {
      out.push({
        id: 'spend-trend',
        tone: delta > 0 ? 'negative' : 'positive',
        text: `Last month you spent ${pct(delta)} ${delta > 0 ? 'more' : 'less'} than your 3-month average.`,
      });
    }
  }

  // The category that jumped most last month vs its recent average.
  if (categoryOf) {
    const byCategory = (key: string) => {
      const totals = new Map<string, number>();
      for (const t of transactions) {
        if (t.kind !== 'expense' && t.kind !== 'fee') continue;
        if (!t.occurredAt.startsWith(key)) continue;
        const category = categoryOf(t.id);
        totals.set(category, (totals.get(category) ?? 0) + Math.abs(Number(t.amount)));
      }
      return totals;
    };
    const lastByCat = byCategory(lastKey);
    const avgByCat = new Map<string, number>();
    for (const back of [2, 3, 4]) {
      for (const [category, value] of byCategory(shift(now, back))) {
        avgByCat.set(category, (avgByCat.get(category) ?? 0) + value / 3);
      }
    }
    let best: { category: string; delta: number; amount: number } | null = null;
    for (const [category, amount] of lastByCat) {
      if (category === 'Uncategorized') continue;
      const avg = avgByCat.get(category) ?? 0;
      if (avg < 20) continue; // ignore tiny categories
      const delta = (amount - avg) / avg;
      if (delta >= 0.4 && (!best || delta > best.delta)) {
        best = { category, delta, amount };
      }
    }
    if (best) {
      out.push({
        id: 'cat-jump',
        tone: 'negative',
        text: `${best.category} was ${pct(best.delta)} above your usual last month (${fmt(best.amount)}).`,
      });
    }
  }

  // Dividends and interest received this month.
  const div = dividends(thisKey);
  if (div > 0) {
    out.push({
      id: 'dividends',
      tone: 'positive',
      text: `You've earned ${fmt(div)} in dividends and interest this month.`,
    });
  }

  // Cash sitting uninvested.
  const investable = cash + investments;
  if (cash >= 2000 && investable > 0) {
    const ratio = cash / investable;
    if (ratio >= 0.45) {
      out.push({
        id: 'cash-idle',
        tone: 'neutral',
        text: `${fmt(cash)} is sitting in cash — ${pct(ratio)} of your investable money.`,
      });
    }
  }

  return out;
};
