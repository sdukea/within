import { useLayoutEffect, useRef, useState } from "react";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * A quiet text tab set: no pills, no fills — just weight, color, and a hairline
 * that slides beneath whichever option is active.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = btnRefs.current[value];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: elRect.left - containerRect.left, width: elRect.width });
    }
  }, [value, options.length]);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-6 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          ref={(el) => {
            btnRefs.current[opt.value] = el;
          }}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative whitespace-nowrap rounded-sm py-1 text-[13px] font-medium tracking-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
            value === opt.value ? "text-ink-950" : "text-ink-500 hover:text-ink-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {indicator ? (
        <div
          className="pointer-events-none absolute bottom-[-7px] h-px bg-ink-950 transition-[left,width] duration-300 ease-quiet"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
    </div>
  );
}
