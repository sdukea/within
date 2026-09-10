type Props = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: Props) {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {body ? <p className="max-w-md text-sm text-zinc-500">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-zinc-500 border-t-zinc-200" />
      {label}
    </div>
  );
}
