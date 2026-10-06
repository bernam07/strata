export const BricksetLogo = ({ size = 44 }: { size?: number }) => (
  <div
    className="flex shrink-0 items-center justify-center rounded-xl bg-[#23497C] shadow-sm"
    style={{ width: size, height: size }}
    aria-label="Brickset Logo"
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
      {/* 2x4 LEGO brick with studs */}
      <rect x="2" y="8" width="20" height="12" rx="2" fill="white" fillOpacity={0.25} />
      <circle cx="6" cy="5" r="1.75" fill="white" />
      <circle cx="12" cy="5" r="1.75" fill="white" />
      <circle cx="18" cy="5" r="1.75" fill="white" />
    </svg>
  </div>
);
