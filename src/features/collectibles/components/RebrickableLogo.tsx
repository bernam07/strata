export const RebrickableLogo = ({ size = 44 }: { size?: number }) => (
  <div
    className="flex shrink-0 items-center justify-center rounded-xl bg-[#D01012] shadow-sm"
    style={{ width: size, height: size }}
    aria-label="Rebrickable LEGO Logo"
  >
    <svg
      width={Math.round(size * 0.6)}
      height={Math.round(size * 0.6)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 2x2 LEGO brick representation */}
      <rect x="3" y="7" width="18" height="13" rx="2" fill="white" fillOpacity={0.2} />
      <circle cx="8" cy="4.5" r="2" fill="white" />
      <circle cx="16" cy="4.5" r="2" fill="white" />
    </svg>
  </div>
);
