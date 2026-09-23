type LogoProps = { className?: string; "aria-label"?: string };

/**
 * Within's mark — a ring with an offset punched-out circle, drawn as a
 * single evenodd path so it reads correctly in `currentColor` on any
 * surface (light rail, dark tile, inline with text) without a
 * background-matched cutout color.
 */
export function Logo({ className = "h-4 w-4", "aria-label": ariaLabel }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.5 12A8.5 8.5 0 1 1 20.499 11.9Z M17.3 9.9A3.6 3.6 0 1 1 17.299 9.8Z"
      />
    </svg>
  );
}
