/**
 * Vendrax brand identity — one mark used everywhere (landing header, app shell,
 * footers). The mark is a botanical sprig: two leaves that meet to form a "V",
 * in forest + sage with a blood-orange berry, tying the full palette into the
 * logo. `Brand` pairs it with the "Vendrax" wordmark set in the display serif.
 */
export function VendraxMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="Vendrax"
    >
      {/* left leaf */}
      <path
        d="M20 32 C 9 27, 7 15, 10.5 6 C 18 10.5, 22.5 22, 20 32 Z"
        fill="#1f3d2b"
      />
      {/* right leaf */}
      <path
        d="M20 32 C 31 27, 33 15, 29.5 6 C 22 10.5, 17.5 22, 20 32 Z"
        fill="#6f8f76"
      />
      {/* leaf midribs */}
      <path d="M20 31 Q 13.5 19, 11 7.5" stroke="#f2f6f1" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      <path d="M20 31 Q 26.5 19, 29 7.5" stroke="#183020" strokeWidth="1.1" strokeLinecap="round" opacity="0.35" />
      {/* stem */}
      <path d="M20 32 V 37" stroke="#1f3d2b" strokeWidth="2" strokeLinecap="round" />
      {/* berry accent */}
      <circle cx="20" cy="33.4" r="2.6" fill="#dc5528" />
    </svg>
  );
}

export function Brand({ size = 32, onDark = false, className = "" }: { size?: number; onDark?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <VendraxMark size={size} />
      <span
        className={`font-display font-semibold tracking-tight ${onDark ? "text-cream-50" : "text-forest-800"}`}
        style={{ fontSize: size * 0.66 }}
      >
        Vendrax
      </span>
    </span>
  );
}
