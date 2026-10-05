export const BrickEconomyLogo = ({ size = 44 }: { size?: number }) => (
  <div
    className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-sm"
    style={{ width: size, height: size }}
    aria-label="BrickEconomy Logo"
  >
    <svg
      width={Math.round(size * 0.58)}
      height={Math.round(size * 0.58)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Brick outline with growth chart trend */}
      <rect x="3" y="6" width="18" height="14" rx="2" fill="white" fillOpacity={0.15} />
      <circle cx="8" cy="4" r="1.5" fill="white" />
      <circle cx="16" cy="4" r="1.5" fill="white" />
      <path d="M7 15l3-3 3 2 4-5" />
      <path d="M17 9h-3v3" />
    </svg>
  </div>
);
