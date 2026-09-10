import { FormEvent, useState } from "react";
import { api, type ChunkHit } from "./api";
import { EmptyState, ErrorState, Spinner } from "./Status";

type Mode = "fulltext" | "semantic" | "hybrid";

type Props = { projectId: number | null };

export function SearchPanel({ projectId }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<ChunkHit[] | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.retrieve(mode, {
        query: query.trim(),
        project_id: projectId,
        limit: 12,
      });
      setHits(res.hits);
      setStrategy(res.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setHits(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={onSubmit} className="border-b border-zinc-800 p-4">
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Raw retrieval
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Inspect ranked chunks…"
            className="h-9 min-w-[16rem] flex-1 rounded border border-zinc-800 bg-ink-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <div className="flex rounded border border-zinc-800 p-0.5">
            {(["fulltext", "semantic", "hybrid"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-8 rounded px-2.5 text-xs ${
                  mode === m ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m === "fulltext" ? "Full-text" : m === "semantic" ? "Semantic" : "Hybrid"}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-9 rounded bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Search
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Full-text uses ts_rank_cd. Semantic uses cosine similarity. Hybrid fuses ranks (RRF,
          k=60). Scores are not on the same scale across modes.
        </p>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? <Spinner label="Running retrieval…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && hits === null ? (
          <EmptyState
            title="No results yet"
            body="Switch modes on the same query to see how lexical, vector, and fused ranking disagree."
          />
        ) : null}
        {hits && hits.length === 0 ? (
          <EmptyState title="Zero hits" body="Try another query or ingest more text." />
        ) : null}
        {hits && hits.length > 0 ? (
          <div>
            <div className="mb-3 font-mono text-[11px] text-zinc-500">
              strategy={strategy} · {hits.length} hits
            </div>
            <ol className="space-y-2">
              {hits.map((hit) => {
                const open = openId === hit.chunk_id;
                return (
                  <li key={hit.chunk_id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : hit.chunk_id)}
                      className="w-full rounded border border-zinc-800 bg-ink-900 p-3 text-left hover:border-zinc-700"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-zinc-100">{hit.document_title}</span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          score {hit.score.toFixed(4)} · rank {hit.rank}
                          {hit.fulltext_rank != null ? ` · ft#${hit.fulltext_rank}` : ""}
                          {hit.semantic_rank != null ? ` · sem#${hit.semantic_rank}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-zinc-600">
                        chunk {hit.chunk_id} · doc {hit.document_id} · index {hit.chunk_index}
                      </div>
                      <p
                        className={`mt-2 text-xs leading-5 text-zinc-400 ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}
                      >
                        {hit.content}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
