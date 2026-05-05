const DARK = "#0058bc";
const LIGHT = "#7aa9e8";

export function MatchmakeMark({ className = "", size = 32, title = "Matchmake" }) {
  return (
    <svg
      aria-label={title}
      role="img"
      className={className}
      width={size}
      height={(size * 56) / 80}
      viewBox="0 0 80 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* Left tournament-bracket arms */}
      <path
        d="M2 12 H10 L16 28 L10 44 H2"
        stroke={DARK}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="2" cy="12" r="2" fill={DARK} />
      <circle cx="2" cy="44" r="2" fill={DARK} />

      {/* Right tournament-bracket arms */}
      <path
        d="M78 12 H70 L64 28 L70 44 H78"
        stroke={LIGHT}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="78" cy="12" r="2" fill={LIGHT} />
      <circle cx="78" cy="44" r="2" fill={LIGHT} />

      {/* Left M-half (dark) */}
      <path
        d="M18 4 L26 4 L40 24 L36 30 L26 18 L26 52 L18 52 Z"
        fill={DARK}
      />

      {/* Right M-half (light) */}
      <path
        d="M62 4 L54 4 L40 24 L44 30 L54 18 L54 52 L62 52 Z"
        fill={LIGHT}
      />

      {/* Center connector dot */}
      <circle cx="40" cy="28" r="3.5" fill="#ffffff" stroke={DARK} strokeWidth="1.5" />
    </svg>
  );
}

export default function MatchmakeLogo({ className = "", markSize = 32, showWordmark = true }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MatchmakeMark size={markSize} />
      {showWordmark && (
        <span className="text-xl font-bold tracking-tight text-on-surface">Matchmake</span>
      )}
    </span>
  );
}
