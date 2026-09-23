import { FormEvent, useState } from "react";
import { api, type NlSqlResponse } from "./api";
import { ArrowIcon } from "./Icons";
import { ErrorState, Spinner } from "./Status";

export function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NlSqlResponse | null>(null);

  const hasStarted = loading || !!result || !!error;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.nlSql(question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={hasStarted ? "border-b border-ink-100 px-8 pb-6" : "flex flex-1 flex-col items-center justify-center px-8 pb-32"}>
        {!hasStarted ? (
          <p className="mb-5 font-serif text-[26px] italic text-ink-700">Ask the schema.</p>
        ) : null}
        <form onSubmit={onSubmit} className={hasStarted ? "" : "w-full max-w-xl"}>
          <div
            className={`flex items-end gap-3 border-b transition-colors duration-150 ${
              hasStarted ? "border-ink-200 pb-2" : "border-ink-300 pb-3 focus-within:border-ink-950"
            }`}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              autoFocus
              placeholder="How many chunks per document?"
              className={`min-w-0 flex-1 bg-transparent text-ink-950 placeholder:text-ink-500 focus:outline-none ${
                hasStarted ? "text-[15px]" : "text-[22px] font-light"
              }`}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Run"
              className="mb-0.5 shrink-0 rounded-full p-1.5 text-ink-950 transition-all duration-150 hover:bg-ink-100 active:scale-95 disabled:pointer-events-none disabled:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
        {!hasStarted ? (
          <p className="mt-3 text-[12.5px] text-ink-500">
            Counts, filters, and joins over projects, documents, and chunks — read only.
          </p>
        ) : null}
      </div>

      {hasStarted ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          {loading ? <Spinner label="Writing and running SQL…" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {result ? (
            <div className="grid animate-fade-up gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Generated SQL
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-ink-100 pt-3 font-mono text-[12.5px] leading-6 text-ink-700">
                  {result.sql}
                </pre>
              </div>
              <div className="min-w-0">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Result · {result.row_count} {result.row_count === 1 ? "row" : "rows"}
                </div>
                <div className="overflow-x-auto border-t border-ink-100">
                  {result.columns.length === 0 ? (
                    <p className="pt-3 text-[13px] text-ink-500">No columns returned.</p>
                  ) : (
                    <table className="w-full min-w-max text-left text-[12.5px]">
                      <thead className="text-ink-500">
                        <tr>
                          {result.columns.map((col) => (
                            <th key={col} className="border-b border-ink-100 py-2 pr-4 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="border-b border-ink-100/70 last:border-0">
                            {result.columns.map((col) => (
                              <td key={col} className="max-w-xs truncate py-2 pr-4 font-mono text-ink-700">
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
      ) : null}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
