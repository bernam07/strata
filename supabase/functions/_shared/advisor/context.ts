export interface RawAdvisorData {
  accounts: Array<{
    name: string;
    type: string;
    currency: string;
    institution_id: string;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    amount: string;
    currency: string;
    occurred_at: string;
    note: string | null;
    source: string;
    instrument_id: string | null;
  }>;
  holdings: Array<{
    instrument_id: string;
    quantity: string;
    average_price: string;
    current_price: string | null;
    previous_close: string | null;
    currency: string;
    updated_at: string;
  }>;
  instruments: Array<{
    id: string;
    ticker: string;
    name: string;
    currency: string;
    sector: string | null;
  }>;
  snapshots: Array<{
    as_of: string;
    net: string;
    assets: string;
    liabilities: string;
    investments: string;
  }>;
  brokers: Array<{
    provider: string;
    free: string;
    invested: string;
    ppl: string;
    total: string;
    currency: string;
    updated_at: string;
  }>;
  crypto?: Array<{
    symbol: string;
    name: string;
    quantity: string;
    current_price: string | null;
    currency: string;
  }>;
  categories?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  txCategories?: Array<{
    transaction_id: string;
    category_id: string;
  }>;
  budgets?: Array<{
    category_id: string;
    amount_limit: string;
    currency: string;
    period: string;
  }>;
}

export interface EnrichedAdvisorContext {
  accounts: Array<{
    name: string;
    type: string;
    currency: string;
    institution: string;
  }>;
  holdings: Array<{
    ticker: string;
    name: string;
    quantity: string;
    averagePrice: string;
    currentPrice: string | null;
    currency: string;
    sector: string | null;
  }>;
  crypto: Array<{
    symbol: string;
    name: string;
    quantity: string;
    currentPrice: string | null;
    currency: string;
  }>;
  recentTransactions: Array<{
    date: string;
    kind: string;
    amount: string;
    currency: string;
    category: string | null;
    asset: string | null;
    note: string | null;
  }>;
  budgets: Array<{
    category: string;
    limit: string;
    period: string;
    currency: string;
  }>;
  netWorthHistory: Array<{
    asOf: string;
    netWorth: string;
    assets: string;
    liabilities: string;
    investments: string;
  }>;
  brokerAccounts: Array<{
    provider: string;
    total: string;
    cashFree: string;
    invested: string;
    profitAndLoss: string;
    currency: string;
  }>;
}

export interface AdvisorSource {
  label: string;
  path: string;
}

export const enrichAdvisorContext = (raw: RawAdvisorData): EnrichedAdvisorContext => {
  const instrumentMap = new Map<
    string,
    { ticker: string; name: string; currency: string; sector: string | null }
  >();
  for (const inst of raw.instruments) {
    instrumentMap.set(inst.id, {
      ticker: inst.ticker,
      name: inst.name,
      currency: inst.currency,
      sector: inst.sector,
    });
  }

  const categoryMap = new Map<string, string>();
  for (const cat of raw.categories ?? []) {
    categoryMap.set(cat.id, cat.name);
  }

  const txCategoryMap = new Map<string, string>();
  for (const tc of raw.txCategories ?? []) {
    const name = categoryMap.get(tc.category_id);
    if (name) txCategoryMap.set(tc.transaction_id, name);
  }

  const holdings = raw.holdings.map((h) => {
    const inst = instrumentMap.get(h.instrument_id);
    return {
      ticker: inst?.ticker ?? 'UNKNOWN',
      name: inst?.name ?? 'Unknown asset',
      quantity: h.quantity,
      averagePrice: h.average_price,
      currentPrice: h.current_price,
      currency: h.currency,
      sector: inst?.sector ?? null,
    };
  });

  const crypto = (raw.crypto ?? []).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    quantity: c.quantity,
    currentPrice: c.current_price,
    currency: c.currency,
  }));

  const recentTransactions = raw.transactions.map((tx) => {
    const inst = tx.instrument_id ? instrumentMap.get(tx.instrument_id) : null;
    return {
      date: tx.occurred_at,
      kind: tx.kind,
      amount: tx.amount,
      currency: tx.currency,
      category: txCategoryMap.get(tx.id) ?? null,
      asset: inst ? `${inst.name} (${inst.ticker})` : null,
      note: tx.note,
    };
  });

  const budgets = (raw.budgets ?? []).map((b) => ({
    category: categoryMap.get(b.category_id) ?? 'Unknown',
    limit: b.amount_limit,
    period: b.period,
    currency: b.currency,
  }));

  const accounts = raw.accounts.map((a) => ({
    name: a.name,
    type: a.type,
    currency: a.currency,
    institution: a.institution_id,
  }));

  const netWorthHistory = raw.snapshots.map((s) => ({
    asOf: s.as_of,
    netWorth: s.net,
    assets: s.assets,
    liabilities: s.liabilities,
    investments: s.investments,
  }));

  const brokerAccounts = raw.brokers.map((b) => ({
    provider: b.provider,
    total: b.total,
    cashFree: b.free,
    invested: b.invested,
    profitAndLoss: b.ppl,
    currency: b.currency,
  }));

  return {
    accounts,
    holdings,
    crypto,
    recentTransactions,
    budgets,
    netWorthHistory,
    brokerAccounts,
  };
};

export const detectSources = (answer: string, question = ''): AdvisorSource[] => {
  const text = `${answer} ${question}`.toLowerCase();
  const sources: AdvisorSource[] = [];

  const add = (label: string, path: string) => {
    if (!sources.some((s) => s.path === path)) {
      sources.push({ label, path });
    }
  };

  if (
    text.includes('[overview]') ||
    text.includes('património') ||
    text.includes('patrimonio') ||
    text.includes('net worth') ||
    text.includes('visão geral') ||
    text.includes('overview')
  ) {
    add('Overview', '/');
  }

  if (
    text.includes('[portfolio]') ||
    text.includes('holding') ||
    text.includes('posição') ||
    text.includes('posições') ||
    text.includes('ações') ||
    text.includes('acoes') ||
    text.includes('etf') ||
    text.includes('portfolio')
  ) {
    add('Portfolio', '/positions');
  }

  if (
    text.includes('[transactions]') ||
    text.includes('transa') ||
    text.includes('movimento') ||
    text.includes('transaction')
  ) {
    add('Transactions', '/transactions');
  }

  if (
    text.includes('[dividends]') ||
    text.includes('dividendo') ||
    text.includes('dividend')
  ) {
    add('Dividends', '/dividends');
  }

  if (
    text.includes('[crypto]') ||
    text.includes('cripto') ||
    text.includes('crypto') ||
    text.includes('bitcoin') ||
    text.includes('ethereum')
  ) {
    add('Crypto', '/crypto');
  }

  if (
    text.includes('[expenses]') ||
    text.includes('orçamento') ||
    text.includes('orcamento') ||
    text.includes('budget') ||
    text.includes('despesa') ||
    text.includes('gasto') ||
    text.includes('expense')
  ) {
    add('Expenses', '/expenses');
  }

  return sources.length > 0
    ? sources
    : [
        { label: 'Overview', path: '/' },
        { label: 'Portfolio', path: '/positions' },
        { label: 'Transactions', path: '/transactions' },
      ];
};
