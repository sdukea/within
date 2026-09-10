import { FormEvent, useState } from "react";
import type { Document, Project } from "./api";

type Props = {
  projects: Project[];
  documents: Document[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
  onDeleteDocument: (id: number) => Promise<void>;
  onIngest: (title: string, text: string) => Promise<void>;
  loadingProjects: boolean;
  ingesting: boolean;
};

export function Sidebar({
  projects,
  documents,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onDeleteDocument,
  onIngest,
  loadingProjects,
  ingesting,
}: Props) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  async function submitProject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateProject(name.trim());
    setName("");
  }

  async function submitDoc(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;
    await onIngest(title.trim(), text);
    setTitle("");
    setText("");
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-zinc-800 bg-ink-900">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Knowledge database
        </div>
        <div className="mt-0.5 font-mono text-sm font-medium text-zinc-100">RecallDB</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Projects
          </h2>
          {loadingProjects ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-200" />
          ) : null}
        </div>
        <form onSubmit={submitProject} className="mb-3 flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project"
            className="h-8 flex-1 rounded border border-zinc-800 bg-ink-950 px-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            className="h-8 rounded border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Add
          </button>
        </form>
        <ul className="space-y-0.5">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectProject(p.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  selectedProjectId === p.id
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-2 font-mono text-[10px] text-zinc-500">{p.document_count}</span>
              </button>
            </li>
          ))}
        </ul>
        {selectedProjectId ? (
          <button
            type="button"
            onClick={() => onDeleteProject(selectedProjectId)}
            className="mt-2 text-[11px] text-zinc-600 hover:text-red-400"
          >
            Delete project
          </button>
        ) : null}

        <h2 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Documents
        </h2>
        {!selectedProjectId ? (
          <p className="text-xs text-zinc-600">Select a project.</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-zinc-600">No documents yet.</p>
        ) : (
          <ul className="space-y-1">
            {documents.map((d) => (
              <li
                key={d.id}
                className="group flex items-start justify-between gap-2 rounded border border-transparent px-2 py-1.5 hover:border-zinc-800 hover:bg-ink-950"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-200">{d.title}</div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    {d.chunk_count} chunks
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteDocument(d.id)}
                  className="text-[11px] text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submitDoc} className="border-t border-zinc-800 p-3">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Add document
        </h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          disabled={!selectedProjectId || ingesting}
          className="mb-1.5 h-8 w-full rounded border border-zinc-800 bg-ink-950 px-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-40"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste source text…"
          rows={6}
          disabled={!selectedProjectId || ingesting}
          className="mb-2 w-full rounded border border-zinc-800 bg-ink-950 px-2 py-1.5 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!selectedProjectId || ingesting || !title.trim() || !text.trim()}
          className="h-8 w-full rounded bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {ingesting ? "Chunking & embedding…" : "Ingest"}
        </button>
      </form>
    </aside>
  );
}
