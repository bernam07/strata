import { Card } from '@/ui/Card';
import { CardTitle } from '@/ui/Heading';
import { pctMax1 as percent } from '@/ui/format';
import type { InstrumentProfile } from '@/features/search/api/useMarket';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const compact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const native = (value: number, currency: string): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
};

const relativeDays = (iso: string | null): string | null => {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const days = Math.round((target - start) / 86_400_000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  const ago = Math.abs(days);
  return `${ago} day${ago === 1 ? '' : 's'} ago`;
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="text-xs text-[var(--text-muted)]">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
      {value}
    </span>
  </div>
);

// Where today's price sits between the 52-week low and high — the one figure
// that needs a picture rather than a number.
const RangeBar = ({
  low,
  high,
  price,
  currency,
}: {
  low: number;
  high: number;
  price: number | null;
  currency: string;
}) => {
  const span = high - low;
  const ratio =
    price !== null && span > 0
      ? Math.max(0, Math.min(1, (price - low) / span))
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-[var(--text-muted)]">52-week range</span>
        {ratio !== null && (
          <span className="text-[11px] font-semibold tabular-nums text-[var(--accent)]">
            {percent.format(ratio)} of range
          </span>
        )}
      </div>
      <div className="relative h-2 rounded-full neu-sunken">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${(ratio ?? 0) * 100}%`,
            background:
              'linear-gradient(90deg, color-mix(in srgb, var(--accent) 35%, transparent), var(--accent))',
          }}
        />
        {ratio !== null && (
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--accent)]"
            style={{ left: `${ratio * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
        <span>{native(low, currency)}</span>
        <span>{native(high, currency)}</span>
      </div>
    </div>
  );
};

export const InstrumentFacts = ({
  profile,
  price,
}: {
  profile: InstrumentProfile;
  price: number | null;
}) => {
  const currency = profile.currency ?? 'USD';

  const dates = [
    { label: 'Next earnings', iso: profile.earningsDate },
    { label: 'Ex-dividend', iso: profile.exDividendDate },
    { label: 'Dividend paid', iso: profile.dividendDate },
  ].filter((entry) => entry.iso !== null);

  const facts: { label: string; value: string }[] = [];
  if (profile.marketCap !== null) {
    facts.push({ label: 'Market cap', value: compact.format(profile.marketCap) });
  }
  if (profile.trailingPe !== null) {
    facts.push({ label: 'P/E (trailing)', value: profile.trailingPe.toFixed(1) });
  }
  if (profile.forwardPe !== null) {
    facts.push({ label: 'P/E (forward)', value: profile.forwardPe.toFixed(1) });
  }
  if (profile.dividendYield !== null) {
    // Yahoo sends this as a fraction on summaryDetail.
    facts.push({
      label: 'Dividend yield',
      value: percent.format(profile.dividendYield),
    });
  }
  if (profile.beta !== null) {
    facts.push({ label: 'Beta', value: profile.beta.toFixed(2) });
  }
  if (profile.dayLow !== null && profile.dayHigh !== null) {
    facts.push({
      label: "Today's range",
      value: `${native(profile.dayLow, currency)} – ${native(profile.dayHigh, currency)}`,
    });
  }

  const hasRange =
    profile.fiftyTwoWeekLow !== null && profile.fiftyTwoWeekHigh !== null;
  if (!hasRange && facts.length === 0 && dates.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Key facts</CardTitle>

      {hasRange && (
        <RangeBar
          low={profile.fiftyTwoWeekLow!}
          high={profile.fiftyTwoWeekHigh!}
          price={price}
          currency={currency}
        />
      )}

      {dates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-field)] neu-flat p-3">
          {dates.map((entry) => (
            <div
              key={entry.label}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-xs text-[var(--text-muted)]">
                {entry.label}
              </span>
              <span className="text-right">
                <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                  {formatDate(entry.iso)}
                </span>
                <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                  {relativeDays(entry.iso)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <div className="grid gap-x-6 sm:grid-cols-2">
          {facts.map((fact) => (
            <Fact key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </div>
      )}

      {(profile.sector || profile.industry) && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {[profile.sector, profile.industry].filter(Boolean).join(' · ')}
        </p>
      )}
    </Card>
  );
};
