import { FormEvent, useEffect, useState } from "react";
import { api, type ChunkHit, type Interaction, type RetrieveResponse } from "./api";
import { SearchIcon } from "./Icons";
import { SegmentedControl } from "./SegmentedControl";
import { EmptyState, ErrorState, Spinner } from "./Status";

type Mode = "fulltext" | "semantic" | "hybrid";

const MODES: { value: Mode; label: string }[] = [
  { value: "fulltext", label: "Full-text" },
  { value: "semantic", label: "Semantic" },
  { value: "hybrid", label: "Hybrid" },
];

type Props = { projectId: number | null };

type ThreadEntry = { id: string; query: string; strategy: string; hits: ChunkHit[] };

export function SearchPanel({ projectId }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    setThread([]);
    setError(null);
    if (projectId == null) return;
    setLoadingHistory(true);
    api
      .history<{ query: string }, RetrieveResponse>(projectId, "search")
      .then((rows: Interaction<{ query: string }, RetrieveResponse>[]) => {
        setThread(
          rows.map((row) => ({
            id: String(row.id),
            query: row.request.query,
            strategy: row.response.strategy,
            hits: row.response.hits,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.retrieve(mode, { query: q, project_id: projectId, limit: 12 });
      setThread((t) => [{ id: `local-${Date.now()}`, query: q, strategy: res.strategy, hits: res.hits }, ...t]);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-100 px-8 pb-5 pt-1">
        <form onSubmit={onSubmit} className="flex items-end gap-3 border-b border-ink-200 pb-2 focus-within:border-ink-950">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Inspect how each strategy ranks a query…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-950 placeholder:text-ink-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label="Search"
            className="mb-0.5 shrink-0 rounded-full p-1.5 text-ink-950 transition-all duration-150 hover:bg-ink-100 active:scale-95 disabled:pointer-events-none disabled:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </form>
        <div className="mt-4">
          <SegmentedControl options={MODES} value={mode} onChange={setMode} />
        </div>
        <p className="mt-3 text-[11.5px] text-ink-500">Scores aren't on the same scale across modes.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loadingHistory && thread.length === 0 ? <Spinner label="Loading history…" /> : null}
        {loading ? <Spinner label="Retrieving…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loadingHistory && !loading && !error && thread.length === 0 ? (
          <EmptyState
            title="Compare how each strategy sees your knowledge"
            body="Run the same query against full-text, semantic, and hybrid retrieval to see where they agree — and where they don't."
          />
        ) : null}
        <div className="max-w-3xl space-y-8">
          {thread.map((entry, i) => (
            <div key={entry.id} className={i > 0 ? "border-t border-ink-100 pt-8" : ""}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 truncate text-[14px] font-medium text-ink-950">{entry.query}</h2>
                <span className="shrink-0 font-mono text-[11px] text-ink-500">{entry.strategy}</span>
              </div>
              {entry.hits.length === 0 ? (
                <p className="text-[13px] text-ink-500">No matches. Try another query, or ingest more text.</p>
              ) : (
                <ol className="divide-y divide-ink-100">
                  {entry.hits.map((hit) => {
                    const open = openId === hit.chunk_id;
                    return (
                      <li key={hit.chunk_id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : hit.chunk_id)}
                          className="block w-full py-3.5 text-left transition-colors duration-150 hover:bg-ink-100/50"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="text-[13.5px] font-medium text-ink-950">{hit.document_title}</span>
                            <span className="shrink-0 font-mono text-[11px] text-ink-500">
                              {hit.rank != null ? `#${hit.rank}` : null}
                              {hit.fulltext_rank != null ? ` · ft ${hit.fulltext_rank}` : ""}
                              {hit.semantic_rank != null ? ` · sem ${hit.semantic_rank}` : ""}
                              {" · "}
                              {hit.score.toFixed(3)}
                            </span>
                          </div>
                          <p className={`mt-1 text-[13px] leading-relaxed text-ink-500 ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                            {hit.content}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
