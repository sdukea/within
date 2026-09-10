import { useCallback, useEffect, useState } from "react";
import { api, type Document, type Project } from "./api";
import { AskPanel } from "./AskPanel";
import { QueryPanel } from "./QueryPanel";
import { SearchPanel } from "./SearchPanel";
import { Sidebar } from "./Sidebar";
import { ErrorState } from "./Status";

type Tab = "ask" | "query" | "search";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("ask");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const refreshProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list);
    return list;
  }, []);

  const refreshDocuments = useCallback(async (projectId: number) => {
    setDocuments(await api.listDocuments(projectId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshProjects();
        if (!cancelled && list.length) {
          setSelectedProjectId((current) => current ?? list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load projects");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProjects]);

  useEffect(() => {
    if (selectedProjectId == null) {
      setDocuments([]);
      return;
    }
    refreshDocuments(selectedProjectId).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Failed to load documents");
    });
  }, [selectedProjectId, refreshDocuments]);

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        documents={documents}
        selectedProjectId={selectedProjectId}
        loadingProjects={loadingProjects}
        ingesting={ingesting}
        onSelectProject={setSelectedProjectId}
        onCreateProject={async (name) => {
          try {
            const created = await api.createProject(name);
            await refreshProjects();
            setSelectedProjectId(created.id);
            setLoadError(null);
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Create project failed");
          }
        }}
        onDeleteProject={async (id) => {
          try {
            await api.deleteProject(id);
            const list = await refreshProjects();
            setSelectedProjectId(list[0]?.id ?? null);
            setLoadError(null);
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Delete project failed");
          }
        }}
        onDeleteDocument={async (id) => {
          try {
            await api.deleteDocument(id);
            if (selectedProjectId) await refreshDocuments(selectedProjectId);
            await refreshProjects();
            setLoadError(null);
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Delete document failed");
          }
        }}
        onIngest={async (title, text) => {
          if (!selectedProjectId) return;
          setIngesting(true);
          try {
            await api.ingest({
              project_id: selectedProjectId,
              title,
              text,
              source: "paste",
            });
            await refreshDocuments(selectedProjectId);
            await refreshProjects();
            setLoadError(null);
          } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Ingest failed");
          } finally {
            setIngesting(false);
          }
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-ink-950">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4">
          <nav className="flex gap-1 py-2">
            {(
              [
                ["ask", "Ask"],
                ["query", "Query"],
                ["search", "Search"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded px-3 py-1.5 text-sm ${
                  tab === id ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="font-mono text-[11px] text-zinc-600">
            {selectedProjectId ? `project_id=${selectedProjectId}` : "no project"}
          </div>
        </header>
        {loadError ? (
          <div className="p-4">
            <ErrorState message={loadError} />
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          {tab === "ask" ? <AskPanel projectId={selectedProjectId} /> : null}
          {tab === "query" ? <QueryPanel /> : null}
          {tab === "search" ? <SearchPanel projectId={selectedProjectId} /> : null}
        </div>
      </main>
    </div>
  );
}
