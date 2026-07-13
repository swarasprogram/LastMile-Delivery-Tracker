/**
 * Trace — brand identity primitives.
 *
 * <TraceMark />   the logo glyph on its own (a location pin traced by a
 *                 dashed live-tracking trail). Colours itself via currentColor,
 *                 so wrap it in `text-brand`, `text-black`, etc.
 * <Brand />       the full lockup: mark badge + "Trace" wordmark + optional
 *                 subtitle. Used in top bars, sidebars and the auth screens.
 */

export function TraceMark({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      {/* live-tracking trail leading into the pin */}
      <path
        d="M3 30 C 11 30, 12 20, 20 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0.1 6"
      />
      {/* location pin */}
      <path
        d="M27 6c-5.52 0-10 4.36-10 9.74 0 6.86 8.6 16.2 9.28 16.93a1 1 0 0 0 1.44 0C28.4 31.94 37 22.6 37 15.74 37 10.36 32.52 6 27 6Z"
        fill="currentColor"
      />
      {/* pin eye */}
      <circle cx="27" cy="15.5" r="3.6" fill="#000" />
    </svg>
  );
}

const SIZES = {
  sm: { badge: "w-8 h-8 rounded-lg",  mark: "w-4 h-4",   name: "text-sm"  },
  md: { badge: "w-9 h-9 rounded-xl",  mark: "w-5 h-5",   name: "text-sm"  },
  lg: { badge: "w-14 h-14 rounded-2xl", mark: "w-8 h-8", name: "text-2xl" },
};

export default function Brand({ size = "md", subtitle, className = "", stacked = false }) {
  const s = SIZES[size] || SIZES.md;

  const badge = (
    <div
      className={`${s.badge} bg-brand text-black flex items-center justify-center shadow-brand shrink-0`}
    >
      <TraceMark className={s.mark} />
    </div>
  );

  if (stacked) {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {badge}
        <div className="text-center">
          <p className={`text-white font-bold tracking-tight ${s.name}`}>Trace</p>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {badge}
      <div className="leading-tight">
        <p className={`text-white font-bold tracking-tight ${s.name}`}>Trace</p>
        {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
      </div>
    </div>
  );
}
