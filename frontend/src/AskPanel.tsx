import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, type Interaction, type RagResponse } from "./api";
import { ArrowIcon } from "./Icons";
import { ErrorState, Spinner } from "./Status";

type Props = {
  projectId: number | null;
  projectName: string | null;
  onOpenSource: (documentId: number, documentTitle: string, chunkId: number) => void;
};

type ThreadEntry = { id: string; question: string; response: RagResponse };

type Segment =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "cite"; number: number; chunkId: number };

/** Splits a plain-text run on **bold** markdown, which small models emit even when told to. */
function splitBold(text: string): Segment[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts
    .map((part, i): Segment | null =>
      part === "" ? null : { type: i % 2 === 1 ? "bold" : "text", content: part }
    )
    .filter((s): s is Segment => s !== null);
}

function parseAnswer(answer: string): { segments: Segment[]; order: number[] } {
  const regex = /\[chunk:(\d+)\]/g;
  const segments: Segment[] = [];
  const order: number[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(answer))) {
    if (match.index > lastIndex) segments.push(...splitBold(answer.slice(lastIndex, match.index)));
    const chunkId = Number(match[1]);
    let idx = order.indexOf(chunkId);
    if (idx === -1) {
      order.push(chunkId);
      idx = order.length - 1;
    }
    segments.push({ type: "cite", number: idx + 1, chunkId });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < answer.length) segments.push(...splitBold(answer.slice(lastIndex)));
  return { segments, order };
}

export function AskPanel({ projectId, projectName, onOpenSource }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setThread([]);
    setError(null);
    if (projectId == null) return;
    setLoadingHistory(true);
    api
      .history<{ question: string }, RagResponse>(projectId, "ask")
      .then((rows: Interaction<{ question: string }, RagResponse>[]) => {
        setThread(rows.map((row) => ({ id: String(row.id), question: row.request.question, response: row.response })));
      })
      .catch(() => {
        /* history is a convenience, not required to use the panel */
      })
      .finally(() => setLoadingHistory(false));
  }, [projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.rag(q, projectId);
      setThread((t) => [{ id: `local-${Date.now()}`, question: q, response }, ...t]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const hasStarted = thread.length > 0 || loading || !!error;

  return (
    <div className="flex h-full flex-col">
      <div
        className={
          hasStarted
            ? "border-b border-ink-100 px-8 pb-6"
            : "flex flex-1 flex-col items-center justify-center px-8 pb-32"
        }
      >
        <form onSubmit={onSubmit} className={hasStarted ? "" : "w-full max-w-xl"}>
          <div
            className={`flex items-end gap-3 border-b transition-colors duration-150 ${
              hasStarted ? "border-ink-200 pb-2" : "border-ink-300 pb-3 focus-within:border-ink-950"
            }`}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              autoFocus
              placeholder="Ask a question…"
              className={`min-w-0 flex-1 bg-transparent text-ink-950 placeholder:text-ink-500 focus:outline-none ${
                hasStarted ? "text-[15px]" : "text-[22px] font-light"
              }`}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Ask"
              className="mb-0.5 shrink-0 rounded-full p-1.5 text-ink-950 transition-all duration-150 hover:bg-ink-100 active:scale-95 disabled:pointer-events-none disabled:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
        {loading ? (
          <div className="mt-3">
            <Spinner label="Reading your knowledge…" />
          </div>
        ) : (
          <p className={`text-[12.5px] text-ink-500 ${hasStarted ? "mt-2" : "mt-3"}`}>
            Searching {projectName ?? "all projects"}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-7">
        {loadingHistory && thread.length === 0 ? <Spinner label="Loading history…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        <div className="space-y-10">
          {thread.map((entry, i) => (
            <AskEntry key={entry.id} entry={entry} divider={i > 0} onOpenSource={onOpenSource} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AskEntry({
  entry,
  divider,
  onOpenSource,
}: {
  entry: ThreadEntry;
  divider: boolean;
  onOpenSource: (documentId: number, documentTitle: string, chunkId: number) => void;
}) {
  const { id, question, response } = entry;
  const [flash, setFlash] = useState<number | null>(null);

  const { segments, order } = useMemo(() => parseAnswer(response.answer), [response.answer]);

  const numberedSources = order
    .map((chunkId, i) => ({ number: i + 1, citation: response.citations.find((c) => c.chunk_id === chunkId) }))
    .filter((s): s is { number: number; citation: NonNullable<typeof s.citation> } => !!s.citation);
  const otherSources = response.citations.filter((c) => !order.includes(c.chunk_id));

  function goToSource(number: number) {
    document.getElementById(`source-${id}-${number}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setFlash(number);
    window.setTimeout(() => setFlash((f) => (f === number ? null : f)), 1100);
  }

  return (
    <article className={divider ? "border-t border-ink-100 pt-10" : ""}>
      <h2 className="mb-4 text-[15px] font-medium text-ink-950">{question}</h2>
      <div className="grid animate-fade-up gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 max-w-[64ch] font-serif text-[18px] leading-[1.65] text-ink-950">
          {segments.length === 0 ? (
            <p>{response.answer}</p>
          ) : (
            <p className="whitespace-pre-wrap">
              {segments.map((seg, i) => {
                if (seg.type === "text") return <span key={i}>{seg.content}</span>;
                if (seg.type === "bold") return <strong key={i} className="font-medium">{seg.content}</strong>;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToSource(seg.number)}
                    className="relative -top-[0.5em] mx-px rounded-sm font-sans text-[11px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {seg.number}
                  </button>
                );
              })}
            </p>
          )}
        </div>

        {response.citations.length > 0 ? (
          <aside className="min-w-0">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-500">Sources</div>
            <ol className="space-y-3.5">
              {numberedSources.map(({ number, citation: c }) => {
                const isFlashing = flash === number;
                return (
                  <li key={c.chunk_id} id={`source-${id}-${number}`}>
                    <button
                      type="button"
                      onClick={() => onOpenSource(c.document_id, c.document_title, c.chunk_id)}
                      className={`block w-full min-w-0 rounded-md py-1 text-left transition-colors duration-300 ${
                        isFlashing ? "bg-accent-soft" : "hover:bg-ink-100/60"
                      }`}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="shrink-0 text-[11px] font-medium text-accent">{number}</span>
                        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-700">
                          {c.document_title}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 pl-[18px] text-[12px] leading-relaxed text-ink-500">
                        {c.content}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>

            {otherSources.length > 0 ? (
              <>
                <div className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Also retrieved
                </div>
                <ul className="space-y-2.5">
                  {otherSources.map((c) => (
                    <li key={c.chunk_id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenSource(c.document_id, c.document_title, c.chunk_id)}
                        className="block w-full min-w-0 rounded-md py-0.5 text-left transition-colors duration-150 hover:bg-ink-100/60"
                      >
                        <div className="truncate text-[12.5px] font-medium text-ink-700">{c.document_title}</div>
                        <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-ink-500">{c.content}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
