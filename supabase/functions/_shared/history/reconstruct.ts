// Rebuilds the market value of a portfolio over time from the transaction
// ledger, using the quantity that was *actually held* on each date rather than
// today's quantity. Prices are expected already converted to a single currency
// (EUR here). Kept pure so it can be unit-tested without any network or DB.

export interface LedgerEntry {
  instrumentId: string;
  quantity: number; // signed: positive on buy, negative on sell
  date: string; // YYYY-MM-DD
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  price: number; // in the common currency (EUR)
}

export interface DailyValue {
  date: string;
  investments: number;
}

interface Track {
  events: { date: string; cumulative: number }[];
  ePtr: number;
  qty: number;
  prices: PricePoint[];
  pPtr: number;
  price: number | undefined;
}

const asc = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const round2 = (value: number): number => Math.round(value * 100) / 100;

export const reconstructInvestments = (
  ledger: readonly LedgerEntry[],
  pricesByInstrument: Map<string, readonly PricePoint[]>,
): DailyValue[] => {
  const byInstrument = new Map<string, LedgerEntry[]>();
  for (const entry of ledger) {
    if (!entry.instrumentId) continue;
    const bucket = byInstrument.get(entry.instrumentId) ?? [];
    bucket.push(entry);
    byInstrument.set(entry.instrumentId, bucket);
  }

  const tracks: Track[] = [];
  const dates = new Set<string>();
  for (const [instrumentId, entries] of byInstrument) {
    const prices = pricesByInstrument.get(instrumentId);
    if (!prices || prices.length === 0) continue; // can't value → skip instrument

    const sortedEntries = [...entries].sort((a, b) => asc(a.date, b.date));
    const events: { date: string; cumulative: number }[] = [];
    let cumulative = 0;
    for (const entry of sortedEntries) {
      cumulative += entry.quantity;
      const last = events[events.length - 1];
      if (last && last.date === entry.date) last.cumulative = cumulative;
      else events.push({ date: entry.date, cumulative });
    }

    const sortedPrices = [...prices].sort((a, b) => asc(a.date, b.date));
    for (const point of sortedPrices) dates.add(point.date);
    tracks.push({ events, ePtr: 0, qty: 0, prices: sortedPrices, pPtr: 0, price: undefined });
  }

  if (tracks.length === 0) return [];

  const out: DailyValue[] = [];
  for (const date of [...dates].sort(asc)) {
    let total = 0;
    let complete = true;
    for (const track of tracks) {
      while (track.ePtr < track.events.length && track.events[track.ePtr].date <= date) {
        track.qty = track.events[track.ePtr].cumulative;
        track.ePtr++;
      }
      while (track.pPtr < track.prices.length && track.prices[track.pPtr].date <= date) {
        track.price = track.prices[track.pPtr].price;
        track.pPtr++;
      }
      const held = track.qty > 0 ? track.qty : 0;
      if (held === 0) continue; // not held yet, or sold out — no contribution
      if (track.price === undefined) {
        complete = false; // held but no price on/before this date — can't value the day
        break;
      }
      total += held * track.price;
    }
    if (!complete || total <= 0) continue;
    out.push({ date, investments: round2(total) });
  }

  return out;
};
