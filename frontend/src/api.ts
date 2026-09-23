const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(
  /\/$/,
  ""
);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const isFormData = init?.body instanceof FormData;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        // Let the browser set Content-Type (with boundary) for FormData.
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, `Cannot reach API at ${API_BASE}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export type Project = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  document_count: number;
};

export type Document = {
  id: number;
  project_id: number;
  title: string;
  source: string | null;
  created_at: string;
  chunk_count: number;
};

export type ChunkHit = {
  chunk_id: number;
  document_id: number;
  document_title: string;
  project_id: number;
  chunk_index: number;
  content: string;
  score: number;
  created_at: string;
  rank: number | null;
  fulltext_rank: number | null;
  semantic_rank: number | null;
};

export type RetrieveResponse = {
  hits: ChunkHit[];
  strategy: string;
};

export type RagResponse = {
  answer: string;
  citations: {
    chunk_id: number;
    document_id: number;
    document_title: string;
    content: string;
    score: number;
  }[];
  strategy: string;
};

export type NlSqlResponse = {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
};

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  createProject: (name: string, description?: string) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description: description || null }),
    }),
  deleteProject: (id: number) =>
    request<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  listDocuments: (projectId: number) =>
    request<Document[]>(`/projects/${projectId}/documents`),
  deleteDocument: (id: number) =>
    request<{ deleted: boolean }>(`/documents/${id}`, { method: "DELETE" }),
  ingest: (payload: { project_id: number; title: string; text: string; source?: string }) =>
    request<{ document: Document; chunk_count: number }>("/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  ingestFile: (payload: { project_id: number; title?: string; file: File }) => {
    const form = new FormData();
    form.set("project_id", String(payload.project_id));
    if (payload.title) form.set("title", payload.title);
    form.set("file", payload.file);
    return request<{ document: Document; chunk_count: number }>("/ingest/file", {
      method: "POST",
      body: form,
    });
  },
  retrieve: (
    mode: "fulltext" | "semantic" | "hybrid",
    payload: { query: string; project_id?: number | null; limit?: number }
  ) =>
    request<RetrieveResponse>(`/retrieve/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rag: (question: string, projectId: number | null) =>
    request<RagResponse>("/rag", {
      method: "POST",
      body: JSON.stringify({ question, project_id: projectId, limit: 8 }),
    }),
  nlSql: (question: string) =>
    request<NlSqlResponse>("/nl-sql", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
