import { FormEvent, useEffect, useState } from "react";
import { api, type Interaction, type NlSqlResponse } from "./api";
import { ArrowIcon, CheckIcon, CopyIcon } from "./Icons";
import { ErrorState, Spinner } from "./Status";

type Props = { projectId: number | null; projectName: string | null };

type ThreadEntry = { id: string; question: string; response: NlSqlResponse };

export function QueryPanel({ projectId, projectName }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setThread([]);
    setError(null);
    if (projectId == null) return;
    setLoadingHistory(true);
    api
      .history<{ question: string }, NlSqlResponse>(projectId, "query")
      .then((rows: Interaction<{ question: string }, NlSqlResponse>[]) => {
        setThread(rows.map((row) => ({ id: String(row.id), question: row.request.question, response: row.response })));
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [projectId]);

  const hasStarted = thread.length > 0 || loading || !!error;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.nlSql(q, projectId);
      setThread((t) => [{ id: `local-${Date.now()}`, question: q, response }, ...t]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={hasStarted ? "border-b border-ink-100 px-8 pb-6" : "flex flex-1 flex-col items-center justify-center px-8 pb-32"}>
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
        {loading ? (
          <div className="mt-3">
            <Spinner label="Writing and running SQL…" />
          </div>
        ) : (
          <p className={`text-[12.5px] text-ink-500 ${hasStarted ? "mt-2" : "mt-3"}`}>
            {hasStarted
              ? `Scoped to ${projectName ?? "all projects"} — read only.`
              : "Counts, filters, and joins over projects, documents, and chunks — read only."}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
        {loadingHistory && thread.length === 0 ? <Spinner label="Loading history…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        <div className="space-y-10">
          {thread.map((entry, i) => (
            <QueryEntry key={entry.id} entry={entry} divider={i > 0} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QueryEntry({ entry, divider }: { entry: ThreadEntry; divider: boolean }) {
  const { question, response } = entry;
  const [copied, setCopied] = useState(false);

  async function copySql() {
    let ok = true;
    try {
      await navigator.clipboard.writeText(response.sql);
    } catch {
      // Some browsers/contexts restrict the async Clipboard API — fall back
      // to the legacy execCommand approach via an offscreen textarea.
      const textarea = document.createElement("textarea");
      textarea.value = response.sql;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <article className={divider ? "border-t border-ink-100 pt-10" : ""}>
      <h2 className="mb-4 text-[15px] font-medium text-ink-950">{question}</h2>
      <div className="grid animate-fade-up gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Generated SQL</div>
            <button
              type="button"
              onClick={copySql}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3 w-3 text-accent" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-ink-100 pt-3 font-mono text-[12.5px] leading-6 text-ink-700">
            {response.sql}
          </pre>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
            Result · {response.row_count} {response.row_count === 1 ? "row" : "rows"}
          </div>
          <div className="overflow-x-auto border-t border-ink-100">
            {response.columns.length === 0 ? (
              <p className="pt-3 text-[13px] text-ink-500">No columns returned.</p>
            ) : (
              <table className="w-full min-w-max text-left text-[12.5px]">
                <thead className="text-ink-500">
                  <tr>
                    {response.columns.map((col) => (
                      <th key={col} className="border-b border-ink-100 py-2 pr-4 font-medium">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {response.rows.map((row, i) => (
                    <tr key={i} className="border-b border-ink-100/70 last:border-0">
                      {response.columns.map((col) => (
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
    </article>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
