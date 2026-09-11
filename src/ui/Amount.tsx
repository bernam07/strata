// Big monetary headline with the euro sign lifted into a superscript, e.g.
// 1,280·⁰⁰ €. Used for the hero figure on a page. The integer and fractional
// parts are formatted separately so each can carry its own weight and colour.
const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

type Size = 'lg' | 'xl';

const scale: Record<Size, { whole: string; cents: string; cur: string }> = {
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
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = grouped.format(Math.floor(abs));
  const cents = Math.round((abs - Math.floor(abs)) * 100)
    .toString()
    .padStart(2, '0');
  const s = scale[size];

  return (
    <span className="inline-flex items-start font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--text-strong)]">
      {sign && (
        <span className={`${s.cents} mr-0.5 font-bold`}>{negative ? '−' : '+'}</span>
      )}
      <span className={s.whole}>{whole}</span>
      <span className={`${s.cents} font-bold text-[var(--text-2)]`}>.{cents}</span>
      <span className={`${s.cur} ml-[3px] mt-[2px] font-bold text-[var(--accent)]`}>€</span>
    </span>
  );
};
