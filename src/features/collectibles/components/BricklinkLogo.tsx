export const BricklinkLogo = ({ size = 44 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0 rounded-xl"
  >
    {/* Dark subtle background */}
    <rect width="48" height="48" rx="12" fill="#1B8057" />
    
    {/* 3D Isometric LEGO Brick in classic Bricklink green & light green */}
    <g transform="translate(6, 8)">
      {/* Top face */}
      <polygon
        points="18,3 32,10 18,17 4,10"
        fill="#34D399"
      />
      {/* Left face */}
      <polygon
        points="4,10 18,17 18,27 4,20"
        fill="#059669"
      />
      {/* Right face */}
      <polygon
        points="18,17 32,10 32,20 18,27"
        fill="#047857"
      />
      
      {/* Stud 1 (top-left) */}
      <ellipse cx="14" cy="9" rx="3.5" ry="2" fill="#6EE7B7" />
      <path d="M10.5,9 C10.5,10.2 17.5,10.2 17.5,9" stroke="#059669" strokeWidth="0.8" fill="none" />

      {/* Stud 2 (top-right) */}
      <ellipse cx="22" cy="13" rx="3.5" ry="2" fill="#6EE7B7" />
      <path d="M18.5,13 C18.5,14.2 25.5,14.2 25.5,13" stroke="#059669" strokeWidth="0.8" fill="none" />
    </g>
  </svg>
);
