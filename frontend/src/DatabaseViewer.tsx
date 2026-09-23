import { useEffect, useState } from "react";
import { api, type TableInfo, type TableRows } from "./api";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DatabaseIcon } from "./Icons";
import { ErrorState, Spinner } from "./Status";

type Props = { onClose: () => void };

const PAGE_SIZE = 25;

export function DatabaseViewer({ onClose }: Props) {
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<TableRows | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    api
      .dbTables()
      .then((t) => {
        setTables(t);
        setSelected((current) => current ?? t[0]?.name ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the database."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingRows(true);
    api
      .dbTableRows(selected, PAGE_SIZE, offset)
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load that table.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, offset]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function selectTable(name: string) {
    setSelected(name);
    setOffset(0);
    setError(null);
  }

  const total = data?.total ?? 0;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/30 p-6 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(720px,85vh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-paper-raised shadow-2xl animate-pop"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4 text-ink-500" />
            <h2 className="text-[15px] font-medium text-ink-950">Database</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="w-48 shrink-0 overflow-y-auto border-r border-ink-100 px-3 py-4">
            <div className="mb-2 px-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
              Tables
            </div>
            {tables === null && !error ? (
              <div className="px-1.5">
                <Spinner label="Loading…" />
              </div>
            ) : (
              <ul className="space-y-0.5">
                {(tables ?? []).map((t) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => selectTable(t.name)}
                      className={`block w-full min-w-0 rounded-md px-1.5 py-[7px] text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        selected === t.name ? "bg-accent-soft text-accent" : "text-ink-700 hover:bg-ink-100/60"
                      }`}
                    >
                      <div className="truncate font-mono text-[12.5px]">{t.name}</div>
                      <div className={`text-[10.5px] ${selected === t.name ? "text-accent/70" : "text-ink-500"}`}>
                        {t.row_count.toLocaleString()} {t.row_count === 1 ? "row" : "rows"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
              {error ? <ErrorState message={error} /> : null}
              {loadingRows && !data ? <Spinner label="Loading table…" /> : null}
              {data ? (
                data.rows.length === 0 ? (
                  <p className="text-[13px] text-ink-500">This table is empty.</p>
                ) : (
                  <table className="w-full min-w-max text-left text-[12.5px]">
                    <thead className="text-ink-500">
                      <tr>
                        {data.columns.map((col) => (
                          <th key={col} className="border-b border-ink-100 py-2 pr-6 font-mono font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => (
                        <tr key={i} className="border-b border-ink-100/70 last:border-0">
                          {data.columns.map((col) => (
                            <td
                              key={col}
                              className="max-w-xs truncate py-2 pr-6 align-top font-mono text-ink-700"
                              title={formatCell(row[col])}
                            >
                              {formatCell(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : null}
            </div>

            {data && data.total > 0 ? (
              <div className="flex shrink-0 items-center justify-between border-t border-ink-100 px-6 py-3">
                <span className="text-[11.5px] text-ink-500">
                  {rangeStart}–{rangeEnd} of {total.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    className="rounded-md p-1.5 text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-950 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={rangeEnd >= total}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    className="rounded-md p-1.5 text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-950 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
