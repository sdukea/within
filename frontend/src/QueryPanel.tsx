import { FormEvent, useState } from "react";
import { api, type NlSqlResponse } from "./api";
import { EmptyState, ErrorState, Spinner } from "./Status";

export function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NlSqlResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.nlSql(question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={onSubmit} className="border-b border-zinc-800 p-4">
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Natural language → SQL
        </label>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How many chunks per document?"
            className="h-9 flex-1 rounded border border-zinc-800 bg-ink-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="h-9 rounded bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Run
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Claude writes a SELECT. The API rejects anything that is not a single
          read-only query against projects / documents / document_chunks.
        </p>
      </form>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {loading ? <Spinner label="Generating and executing SQL…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && !result ? (
          <EmptyState
            title="No query yet"
            body="This path hits the schema, not embeddings. Use it for counts, filters, and joins — not for 'what does this document mean?'."
          />
        ) : null}
        {result ? (
          <div className="grid h-full min-h-[16rem] gap-3 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col overflow-hidden rounded border border-zinc-800">
              <div className="border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
                Generated SQL
              </div>
              <pre className="flex-1 overflow-auto bg-ink-950 p-3 font-mono text-[12px] leading-5 text-emerald-300/90">
                {result.sql}
              </pre>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded border border-zinc-800">
              <div className="border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
                Result · {result.row_count} rows
              </div>
              <div className="flex-1 overflow-auto">
                {result.columns.length === 0 ? (
                  <p className="p-3 text-xs text-zinc-500">No columns returned.</p>
                ) : (
                  <table className="w-full min-w-max text-left text-xs">
                    <thead className="sticky top-0 bg-ink-800 text-zinc-400">
                      <tr>
                        {result.columns.map((col) => (
                          <th key={col} className="px-3 py-2 font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="border-t border-zinc-800/80">
                          {result.columns.map((col) => (
                            <td key={col} className="max-w-xs truncate px-3 py-1.5 font-mono text-zinc-300">
                              {formatCell(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
