type Props = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: Props) {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-1.5 px-6 text-center animate-fade-in">
      <p className="text-[15px] font-medium text-ink-700">{title}</p>
      {body ? <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="animate-fade-in rounded-lg border border-[#e0b4a0] bg-[#fdf3ee] px-3.5 py-2.5 text-[13px] text-[#8a3d1f]">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-ink-500 animate-fade-in">
      <span className="flex items-center gap-1">
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </span>
      {label}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-breathe"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
