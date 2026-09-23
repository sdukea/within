import { useEffect, useRef, useState } from "react";
import { api, type DocumentDetail } from "./api";
import { CloseIcon } from "./Icons";
import { ErrorState, Spinner } from "./Status";

type Props = {
  documentId: number;
  documentTitle: string;
  highlightChunkId?: number;
  onClose: () => void;
};

export function DocumentViewer({ documentId, documentTitle, highlightChunkId, onClose }: Props) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .documentContent(documentId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't open this document.");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (doc) {
      // Let the pop-in finish before scrolling, or the target position is
      // measured mid-animation and lands slightly off.
      const t = window.setTimeout(
        () => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        200
      );
      return () => window.clearTimeout(t);
    }
  }, [doc]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/30 p-6 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-paper-raised shadow-2xl animate-pop"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="min-w-0 truncate text-[15px] font-medium text-ink-950">{documentTitle}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-3 shrink-0 rounded-full p-1.5 text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? <ErrorState message={error} /> : null}
          {!doc && !error ? <Spinner label="Opening document…" /> : null}
          {doc ? (
            <div className="space-y-4 font-serif text-[16px] leading-[1.7] text-ink-950">
              {doc.chunks.map((chunk) => {
                const isHighlighted = chunk.id === highlightChunkId;
                return (
                  <div
                    key={chunk.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={`whitespace-pre-wrap rounded-md transition-colors duration-500 ${
                      isHighlighted ? "-mx-3 border-l-2 border-accent bg-accent-soft px-3 py-2" : ""
                    }`}
                  >
                    {chunk.content}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
