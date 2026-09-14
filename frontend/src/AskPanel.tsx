import { FormEvent, useMemo, useRef, useState } from "react";
import { api, type RagResponse } from "./api";
import { ArrowIcon } from "./Icons";
import { Logo } from "./Logo";
import { ErrorState, Spinner } from "./Status";

type Props = { projectId: number | null; projectName: string | null };

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

export function AskPanel({ projectId, projectName }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasStarted = loading || !!result || !!error;

  const { segments, order } = useMemo(
    () => (result ? parseAnswer(result.answer) : { segments: [], order: [] }),
    [result]
  );

  const numberedSources = order
    .map((chunkId, i) => ({ number: i + 1, citation: result?.citations.find((c) => c.chunk_id === chunkId) }))
    .filter((s): s is { number: number; citation: NonNullable<typeof s.citation> } => !!s.citation);
  const otherSources = result?.citations.filter((c) => !order.includes(c.chunk_id)) ?? [];

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.rag(q.trim(), projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  function goToSource(number: number) {
    document.getElementById(`source-${number}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setFlash(number);
    window.setTimeout(() => setFlash((f) => (f === number ? null : f)), 1100);
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={
          hasStarted
            ? "border-b border-ink-100 px-8 pb-6"
            : "flex flex-1 flex-col items-center justify-center px-8 pb-32"
        }
      >
        {!hasStarted ? (
          <>
            <Logo className="mb-4 h-9 w-9 text-ink-700" aria-label="Within" />
            <p className="mb-5 font-serif text-[26px] italic text-ink-700">Ask your knowledge.</p>
          </>
        ) : null}
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
              placeholder={projectName ? `What do you want to know about ${projectName}?` : "What do you want to know?"}
              className={`min-w-0 flex-1 bg-transparent text-ink-950 placeholder:text-ink-500 focus:outline-none ${
                hasStarted ? "text-[15px]" : "text-[22px] font-light"
              }`}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Ask"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-all duration-150 hover:shadow-md hover:brightness-110 active:scale-90 active:brightness-95 disabled:pointer-events-none disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
        {!hasStarted ? (
          <p className="mt-3 text-[12.5px] text-ink-500">
            Searching {projectName ?? "all projects"}
          </p>
        ) : null}
      </div>

      {hasStarted ? (
        <div className="flex-1 overflow-y-auto px-8 py-7">
          {loading ? <Spinner label="Reading your knowledge…" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {result ? (
            <div className="grid animate-fade-up gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
              <article className="min-w-0 max-w-[64ch] font-serif text-[18px] leading-[1.65] text-ink-950">
                {segments.length === 0 ? (
                  <p>{result.answer}</p>
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
              </article>

              {result.citations.length > 0 ? (
                <aside className="min-w-0">
                  <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                    Sources
                  </div>
                  <ol className="space-y-3.5">
                    {numberedSources.map(({ number, citation: c }) => {
                      const open = openId === c.chunk_id;
                      const isFlashing = flash === number;
                      return (
                        <li key={c.chunk_id} id={`source-${number}`}>
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : c.chunk_id)}
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
                            <p
                              className={`mt-0.5 pl-[18px] text-[12px] leading-relaxed text-ink-500 ${
                                open ? "whitespace-pre-wrap" : "line-clamp-2"
                              }`}
                            >
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
                            <div className="truncate text-[12.5px] font-medium text-ink-700">
                              {c.document_title}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-ink-500">
                              {c.content}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
