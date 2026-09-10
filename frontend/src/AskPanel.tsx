import { FormEvent, useMemo, useState } from "react";
import { api, type RagResponse } from "./api";
import { EmptyState, ErrorState, Spinner } from "./Status";

type Props = { projectId: number | null };

export function AskPanel({ projectId }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const citedIds = useMemo(() => {
    if (!result) return new Set<number>();
    const ids = [...result.answer.matchAll(/\[chunk:(\d+)\]/g)].map((m) => Number(m[1]));
    return new Set(ids);
  }, [result]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.rag(question.trim(), projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "RAG failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={onSubmit} className="border-b border-zinc-800 p-4">
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Question
        </label>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask against retrieved chunks…"
            className="h-9 flex-1 rounded border border-zinc-800 bg-ink-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="h-9 rounded bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Ask
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Hybrid retrieval (full-text + pgvector RRF) → Claude. Scope:{" "}
          {projectId ? `project #${projectId}` : "all projects"}.
        </p>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? <Spinner label="Retrieving and generating…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && !result ? (
          <EmptyState
            title="No answer yet"
            body="Hybrid search pulls lexical and semantic hits, then Claude answers only from those chunks. Citations expand to the source text."
          />
        ) : null}
        {result ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <article className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">
              {result.answer}
            </article>
            <aside className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Citations
              </div>
              {result.citations.length === 0 ? (
                <p className="text-xs text-zinc-600">None returned.</p>
              ) : (
                result.citations.map((c) => {
                  const cited = citedIds.has(c.chunk_id);
                  const open = openId === c.chunk_id;
                  return (
                    <button
                      key={c.chunk_id}
                      type="button"
                      onClick={() => setOpenId(open ? null : c.chunk_id)}
                      className="block w-full rounded border border-zinc-800 bg-ink-900 p-2 text-left hover:border-zinc-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-zinc-200">
                          {c.document_title}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          #{c.chunk_id}
                          {cited ? " · cited" : ""}
                        </span>
                      </div>
                      {open ? (
                        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-zinc-400">
                          {c.content}
                        </p>
                      ) : (
                        <p className="mt-1 truncate text-[11px] text-zinc-500">{c.content}</p>
                      )}
                    </button>
                  );
                })
              )}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
