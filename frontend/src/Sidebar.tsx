import { FormEvent, useEffect, useRef, useState } from "react";
import type { Document, Project, User } from "./api";
import { CheckIcon, ChevronDownIcon, LogOutIcon, PlusIcon, TrashIcon, UploadIcon } from "./Icons";
import { Logo } from "./Logo";
import { SegmentedControl } from "./SegmentedControl";

type Props = {
  user: User;
  onLogout: () => void;
  projects: Project[];
  documents: Document[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
  onDeleteDocument: (id: number) => Promise<void>;
  onIngest: (title: string, text: string) => Promise<void>;
  onIngestFile: (title: string, file: File) => Promise<void>;
  loadingProjects: boolean;
  ingesting: boolean;
};

const ACCEPTED_FILE_EXT = ".pdf,.txt,.md,.markdown";
const MAX_UPLOAD_MB = 20;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised";

export function Sidebar({
  user,
  onLogout,
  projects,
  documents,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onDeleteDocument,
  onIngest,
  onIngestFile,
  loadingProjects,
  ingesting,
}: Props) {
  const [addingProject, setAddingProject] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [docMode, setDocMode] = useState<"paste" | "upload">("paste");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingProject) nameRef.current?.focus();
  }, [addingProject]);

  useEffect(() => {
    if (addingDoc) titleRef.current?.focus();
  }, [addingDoc]);

  async function submitProject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setAddingProject(false);
      return;
    }
    await onCreateProject(name.trim());
    setName("");
    setAddingProject(false);
  }

  function closeDocForm() {
    setAddingDoc(false);
    setTitle("");
    setText("");
    setFile(null);
    setFileError(null);
    setDocMode("paste");
  }

  function pickFile(f: File | null) {
    setFileError(null);
    if (f && f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setFileError(`File is larger than ${MAX_UPLOAD_MB}MB`);
      return;
    }
    setFile(f);
  }

  async function submitDoc(e: FormEvent) {
    e.preventDefault();
    if (docMode === "upload") {
      if (!file) return;
      await onIngestFile(title.trim(), file);
    } else {
      if (!title.trim() || !text.trim()) return;
      await onIngest(title.trim(), text);
    }
    closeDocForm();
  }

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-ink-100 bg-paper-raised">
      <div className="flex items-center gap-2 px-5 pb-5 pt-6">
        <Logo className="h-5 w-5 shrink-0 text-ink-950" />
        <span className="font-serif text-[17px] italic tracking-tight text-ink-950">Within</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-1.5 flex items-center justify-between px-2.5 pt-1">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Projects</h2>
          <div className="flex items-center gap-1.5">
            {loadingProjects ? <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-breathe" /> : null}
            <button
              type="button"
              aria-label="New project"
              onClick={() => setAddingProject(true)}
              className={`rounded p-0.5 text-ink-500 transition-colors duration-150 hover:text-ink-950 ${FOCUS_RING}`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {addingProject ? (
          <form onSubmit={submitProject} className="mb-2 flex animate-fade-in items-center gap-1.5">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!name.trim()) setAddingProject(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setName("");
                  setAddingProject(false);
                }
              }}
              placeholder="Project name"
              className="h-8 min-w-0 flex-1 rounded-md border border-ink-200 bg-paper-raised px-2.5 text-[13px] text-ink-950 placeholder:text-ink-500 transition-colors duration-150 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="submit"
              aria-label="Create project"
              disabled={!name.trim()}
              className={`shrink-0 rounded-md p-1.5 text-ink-500 transition-colors duration-150 hover:text-ink-950 disabled:pointer-events-none disabled:opacity-30 ${FOCUS_RING}`}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}

        <ul className="-mx-1 space-y-0.5">
          {projects.map((p) => {
            const selected = selectedProjectId === p.id;
            return (
              <li key={p.id} className="group/row relative">
                <button
                  type="button"
                  onClick={() => onSelectProject(p.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md py-[7px] pl-1.5 pr-8 text-left text-[13.5px] transition-colors duration-150 ${FOCUS_RING} ${
                    selected ? "bg-ink-100 text-ink-950 font-medium" : "text-ink-700 hover:bg-ink-100/60"
                  }`}
                >
                  <ChevronDownIcon
                    className={`h-3 w-3 shrink-0 text-ink-500 transition-transform duration-200 ${
                      selected ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[10px] text-ink-500">{p.document_count}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(p.id);
                  }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500 opacity-0 transition-all duration-150 hover:bg-[#fdf3ee] hover:text-[#8a3d1f] group-hover/row:opacity-100 ${FOCUS_RING}`}
                >
                  <TrashIcon className="h-3 w-3" />
                </button>

                {/* Accordion: grid-rows trick animates height without measuring it. */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-quiet"
                  style={{ gridTemplateRows: selected ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[18px] mt-0.5 border-l border-ink-100 py-1 pl-3">
                      <div className="mb-1 flex items-center justify-between pr-1">
                        <h3 className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                          Documents
                        </h3>
                        <button
                          type="button"
                          aria-label="Add document"
                          onClick={() => setAddingDoc(true)}
                          className={`rounded p-0.5 text-ink-500 transition-colors duration-150 hover:text-ink-950 ${FOCUS_RING}`}
                        >
                          <PlusIcon className="h-3 w-3" />
                        </button>
                      </div>

                      {addingDoc ? (
                        <form
                          onSubmit={submitDoc}
                          className="mb-2.5 animate-fade-up space-y-1.5 rounded-lg border border-ink-200 bg-paper p-2.5"
                        >
                          <SegmentedControl
                            options={[
                              { value: "paste", label: "Paste" },
                              { value: "upload", label: "Upload" },
                            ]}
                            value={docMode}
                            onChange={(m) => {
                              setDocMode(m);
                              setFileError(null);
                            }}
                            className="mb-2.5 gap-4 pl-0.5"
                          />
                          <input
                            ref={titleRef}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") closeDocForm();
                            }}
                            placeholder={docMode === "upload" ? "Title (defaults to filename)" : "Title"}
                            disabled={ingesting}
                            className="h-7 w-full rounded border border-ink-200 bg-paper-raised px-2 text-[12.5px] text-ink-950 placeholder:text-ink-500 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
                          />

                          {docMode === "paste" ? (
                            <textarea
                              value={text}
                              onChange={(e) => setText(e.target.value)}
                              placeholder="Paste source text…"
                              rows={5}
                              disabled={ingesting}
                              className="w-full rounded border border-ink-200 bg-paper-raised px-2 py-1.5 text-[12.5px] leading-relaxed text-ink-950 placeholder:text-ink-500 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
                            />
                          ) : (
                            <div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_FILE_EXT}
                                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                                disabled={ingesting}
                                className="hidden"
                              />
                              {file ? (
                                <div className="flex items-center justify-between gap-2 rounded border border-ink-200 bg-paper-raised px-2 py-1.5 text-[12.5px] text-ink-950">
                                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                  <button
                                    type="button"
                                    aria-label="Remove file"
                                    onClick={() => pickFile(null)}
                                    disabled={ingesting}
                                    className={`shrink-0 text-ink-500 hover:text-ink-950 disabled:opacity-50 ${FOCUS_RING}`}
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={ingesting}
                                  className={`flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-ink-200 bg-paper-raised px-2 py-3 text-[12.5px] text-ink-500 transition-colors duration-150 hover:border-accent/50 hover:text-ink-700 disabled:opacity-50 ${FOCUS_RING}`}
                                >
                                  <UploadIcon className="h-3.5 w-3.5" />
                                  PDF, .txt, or .md
                                </button>
                              )}
                              {fileError ? <p className="mt-1 text-[11px] text-[#8a3d1f]">{fileError}</p> : null}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-0.5">
                            <button
                              type="button"
                              onClick={closeDocForm}
                              className={`rounded px-1.5 py-1 text-[12px] text-ink-500 hover:text-ink-700 ${FOCUS_RING}`}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={
                                ingesting || (docMode === "upload" ? !file : !title.trim() || !text.trim())
                              }
                              className={`flex items-center gap-1.5 rounded-md bg-ink-950 px-3 py-1 text-[12px] font-medium text-white transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:bg-ink-300 ${FOCUS_RING}`}
                            >
                              {ingesting ? (
                                <>
                                  <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-breathe" />
                                  Adding…
                                </>
                              ) : (
                                "Add"
                              )}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {documents.length === 0 && !addingDoc ? (
                        <p className="px-1 py-1 text-[12.5px] text-ink-500">No documents yet.</p>
                      ) : (
                        <ul className="-mx-1">
                          {documents.map((d) => (
                            <li
                              key={d.id}
                              className="group/doc relative flex items-start gap-2 rounded-md px-1.5 py-[6px] transition-colors duration-150 hover:bg-ink-100/60"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] text-ink-700">{d.title}</div>
                                <div className="font-mono text-[10px] text-ink-500">{d.chunk_count} chunks</div>
                              </div>
                              <button
                                type="button"
                                aria-label="Delete document"
                                onClick={() => onDeleteDocument(d.id)}
                                className={`rounded p-1 text-ink-500 opacity-0 transition-all duration-150 hover:bg-[#fdf3ee] hover:text-[#8a3d1f] group-hover/doc:opacity-100 ${FOCUS_RING}`}
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
        <span className="min-w-0 truncate text-[12px] text-ink-500">{user.email}</span>
        <button
          type="button"
          aria-label="Sign out"
          onClick={onLogout}
          className={`shrink-0 rounded p-1 text-ink-500 transition-colors duration-150 hover:text-ink-950 ${FOCUS_RING}`}
        >
          <LogOutIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
