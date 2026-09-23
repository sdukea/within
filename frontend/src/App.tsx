import { useCallback, useEffect, useState } from "react";
import { api, clearToken, getToken, setUnauthorizedHandler, type Document, type Project, type User } from "./api";
import { AskPanel } from "./AskPanel";
import { Login } from "./Login";
import { QueryPanel } from "./QueryPanel";
import { SearchPanel } from "./SearchPanel";
import { SegmentedControl } from "./SegmentedControl";
import { Sidebar } from "./Sidebar";
import { ErrorState } from "./Status";

type Tab = "ask" | "query" | "search";

const TABS: { value: Tab; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "search", label: "Search" },
  { value: "query", label: "Query" },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("ask");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setProjects([]);
    setDocuments([]);
    setSelectedProjectId(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // On first load, a saved token gets verified once against /auth/me rather
  // than trusted blindly — it may have expired since the last visit.
  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  const refreshProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list);
    return list;
  }, []);

  const refreshDocuments = useCallback(async (projectId: number) => {
    setDocuments(await api.listDocuments(projectId));
  }, []);

  useEffect(() => {
    if (!user) return;
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
  }, [user, refreshProjects]);

  useEffect(() => {
    if (selectedProjectId == null) {
      setDocuments([]);
      return;
    }
    refreshDocuments(selectedProjectId).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Failed to load documents");
    });
  }, [selectedProjectId, refreshDocuments]);

  if (checkingSession) {
    return <div className="h-full bg-paper" />;
  }

  if (!user) {
    return <Login onAuthenticated={setUser} />;
  }

  return (
    <div className="flex h-full bg-paper">
      <Sidebar
        user={user}
        onLogout={logout}
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
            if (selectedProjectId === id) setSelectedProjectId(list[0]?.id ?? null);
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
        onIngestFile={async (title, file) => {
          if (!selectedProjectId) return;
          setIngesting(true);
          try {
            await api.ingestFile({
              project_id: selectedProjectId,
              title: title || undefined,
              file,
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

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center px-8 pb-5 pt-7">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </header>
        {loadError ? (
          <div className="px-8">
            <ErrorState message={loadError} />
          </div>
        ) : null}
        <div key={`${tab}-${selectedProjectId ?? "none"}`} className="min-h-0 flex-1 animate-fade-in">
          {tab === "ask" ? (
            <AskPanel projectId={selectedProjectId} projectName={selectedProject?.name ?? null} />
          ) : null}
          {tab === "query" ? (
            <QueryPanel projectId={selectedProjectId} projectName={selectedProject?.name ?? null} />
          ) : null}
          {tab === "search" ? <SearchPanel projectId={selectedProjectId} /> : null}
        </div>
      </main>
    </div>
  );
}
