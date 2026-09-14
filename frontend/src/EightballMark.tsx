type MarkProps = { className?: string };

/**
 * Eightball brand glyph — a ring with an offset punched-out circle, drawn as
 * a single evenodd path so it reads correctly in `currentColor` on any
 * background. Bare mark only; pair with the wordmark for the full lockup.
 */
export function EightballMark({ className = "h-4 w-4" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.5 12A8.5 8.5 0 1 1 20.499 11.9Z M17.3 9.9A3.6 3.6 0 1 1 17.299 9.8Z"
      />
    </svg>
  );
}

/** Icon + wordmark lockup, quiet by default — sized and colored by the caller. */
export function EightballWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <EightballMark className="h-3 w-3 shrink-0" />
      <span className="font-sans text-[11px] font-medium tracking-tight">Eightball</span>
    </span>
  );
}
