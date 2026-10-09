// Big monetary headline with the euro sign lifted into a superscript, e.g.
// 1,280·⁰⁰ €. Used for the hero figure on a page. The integer and fractional
// parts are formatted separately so each can carry its own weight and colour.
const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

type Size = 'md' | 'lg' | 'xl';

const scale: Record<Size, { whole: string; cents: string; cur: string }> = {
  md: { whole: 'text-[26px]', cents: 'text-[16px]', cur: 'text-[12px]' },
  lg: { whole: 'text-[34px]', cents: 'text-[21px]', cur: 'text-[15px]' },
  xl: { whole: 'text-[42px]', cents: 'text-[26px]', cur: 'text-[17px]' },
};

export const Amount = ({
  value,
  size = 'lg',
  sign = false,
}: {
  value: number;
  size?: Size;
  /** Show a leading + / − for gains and losses. */
  sign?: boolean;
}) => {
  const abs = Math.abs(value);
  const fixed = abs.toFixed(2);
  const [wholeStr, cents] = fixed.split('.');
  const whole = grouped.format(Number(wholeStr));
  const negative = value < -0.005;
  const isPositive = value > 0.005;
  const s = scale[size];

  return (
    <span className="inline-flex items-start font-extrabold leading-none tabular-nums text-[var(--text-strong)]">
      {sign && (isPositive || negative) && (
        <span className={`${s.cents} mr-0.5 font-bold`}>{negative ? '−' : '+'}</span>
      )}
      <span className={s.whole}>{whole}</span>
      <span className={`${s.cents} font-bold text-[var(--text-2)]`}>.{cents}</span>
      <span className={`${s.cur} ml-[3px] mt-[2px] font-bold text-[var(--accent)]`}>€</span>
    </span>
  );
};

const inline = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Row-scale amount with a trailing euro sign, matching the hero treatment.
// Inherits its colour so it works inside positive/negative rows. A negative
// value always shows its sign; `signed` additionally shows a + on positives.
export const AmountInline = ({
  value,
  signed = false,
}: {
  value: number;
  signed?: boolean;
}) => {
  const isNeg = value < -0.005;
  const isPos = value > 0.005;
  const formatted = inline.format(Math.abs(value));
  const sign = isNeg ? '−' : signed && isPos ? '+' : '';
  const length = sign.length + formatted.length + 2;
  const fontSize =
    length > 18 ? '0.64em' : length > 15 ? '0.72em' : length > 10 ? '0.84em' : undefined;

  return (
    <span
      className="inline-block max-w-full whitespace-nowrap tabular-nums"
      style={{ fontSize }}
    >
      {sign}
      {formatted} <span className="opacity-55">€</span>
    </span>
  );
};
