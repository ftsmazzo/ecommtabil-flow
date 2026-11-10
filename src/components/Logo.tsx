export function Logo({ size = 32 }: { size?: number }) {
  const id = `lg${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
      <path d="M13 16h16M13 24h22M13 32h12" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M29 29.5l3 3 6-6.5" stroke="#93c5fd" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OndasMenu() {
  return (
    <svg className="navwave" viewBox="0 0 210 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 60 C 50 30, 90 90, 140 60 S 200 40, 210 50" stroke="#3b82f6" strokeWidth="1.2" fill="none" opacity=".35" />
      <path d="M0 80 C 55 50, 95 110, 145 80 S 205 60, 210 70" stroke="#60a5fa" strokeWidth="1" fill="none" opacity=".22" />
      <path d="M0 100 C 60 70, 100 130, 150 100 S 205 80, 210 90" stroke="#93c5fd" strokeWidth=".8" fill="none" opacity=".15" />
    </svg>
  );
}
