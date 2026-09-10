"""RecallDB API: the database is the product; Claude is a layer on top."""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import close_pool, get_conn, init_pool, migrate
from ingest import ingest_document
from llm import complete
from nl_sql import SqlValidationError, nl_to_sql
from retrieval import (
    fulltext_retrieve,
    hybrid_retrieve,
    semantic_retrieve,
    structured_retrieve,
)
from schemas import (
    Citation,
    DocumentCreate,
    DocumentOut,
    IngestRequest,
    IngestResponse,
    NlSqlRequest,
    NlSqlResponse,
    ProjectCreate,
    ProjectOut,
    RagRequest,
    RagResponse,
    RetrieveResponse,
    StructuredRetrieveRequest,
    TextRetrieveRequest,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    migrate()
    yield
    close_pool()


app = FastAPI(title="RecallDB", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _jsonable_row(row: dict) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            out[key] = value.isoformat()
        elif hasattr(value, "tolist"):
            out[key] = value.tolist()
        else:
            out[key] = value
    return out


@app.get("/health")
def health():
    return {"status": "ok"}


# --- Projects -----------------------------------------------------------------


@app.post("/projects", response_model=ProjectOut)
def create_project(body: ProjectCreate):
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO projects (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description, created_at
            """,
            (body.name, body.description),
        ).fetchone()
        conn.commit()
    return {**row, "document_count": 0}


@app.get("/projects", response_model=list[ProjectOut])
def list_projects():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id, p.name, p.description, p.created_at,
                COUNT(d.id)::int AS document_count
            FROM projects p
            LEFT JOIN documents d ON d.project_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            """
        ).fetchall()
    return rows


@app.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int):
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                p.id, p.name, p.description, p.created_at,
                COUNT(d.id)::int AS document_count
            FROM projects p
            LEFT JOIN documents d ON d.project_id = p.id
            WHERE p.id = %s
            GROUP BY p.id
            """,
            (project_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Project not found")
    return row


@app.delete("/projects/{project_id}")
def delete_project(project_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM projects WHERE id = %s RETURNING id", (project_id,)
        ).fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(404, "Project not found")
    return {"deleted": True, "id": project_id}


# --- Documents ----------------------------------------------------------------


@app.post("/documents", response_model=DocumentOut)
def create_document(body: DocumentCreate):
    with get_conn() as conn:
        project = conn.execute(
            "SELECT id FROM projects WHERE id = %s", (body.project_id,)
        ).fetchone()
        if project is None:
            raise HTTPException(404, "Project not found")
        row = conn.execute(
            """
            INSERT INTO documents (project_id, title, source)
            VALUES (%s, %s, %s)
            RETURNING id, project_id, title, source, created_at
            """,
            (body.project_id, body.title, body.source),
        ).fetchone()
        conn.commit()
    return {**row, "chunk_count": 0}


@app.get("/projects/{project_id}/documents", response_model=list[DocumentOut])
def list_documents(project_id: int):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                d.id, d.project_id, d.title, d.source, d.created_at,
                COUNT(c.id)::int AS chunk_count
            FROM documents d
            LEFT JOIN document_chunks c ON c.document_id = d.id
            WHERE d.project_id = %s
            GROUP BY d.id
            ORDER BY d.created_at DESC
            """,
            (project_id,),
        ).fetchall()
    return rows


@app.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: int):
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                d.id, d.project_id, d.title, d.source, d.created_at,
                COUNT(c.id)::int AS chunk_count
            FROM documents d
            LEFT JOIN document_chunks c ON c.document_id = d.id
            WHERE d.id = %s
            GROUP BY d.id
            """,
            (document_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row


@app.delete("/documents/{document_id}")
def delete_document(document_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM documents WHERE id = %s RETURNING id", (document_id,)
        ).fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(404, "Document not found")
    return {"deleted": True, "id": document_id}


# --- Ingestion ----------------------------------------------------------------


@app.post("/ingest", response_model=IngestResponse)
def ingest(body: IngestRequest):
    try:
        result = ingest_document(body.project_id, body.title, body.text, body.source)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Ingestion failed: {exc}") from exc
    return result


# --- Retrieval (kept as four distinct routes so each strategy is inspectable) --


@app.post("/retrieve/structured", response_model=RetrieveResponse)
def retrieve_structured(body: StructuredRetrieveRequest):
    hits = structured_retrieve(
        project_id=body.project_id,
        title=body.title,
        created_from=body.created_from,
        created_to=body.created_to,
        limit=body.limit,
    )
    return {"hits": hits, "strategy": "structured"}


@app.post("/retrieve/fulltext", response_model=RetrieveResponse)
def retrieve_fulltext(body: TextRetrieveRequest):
    hits = fulltext_retrieve(
        query=body.query,
        project_id=body.project_id,
        title=body.title,
        created_from=body.created_from,
        created_to=body.created_to,
        limit=body.limit,
    )
    return {"hits": hits, "strategy": "fulltext"}


@app.post("/retrieve/semantic", response_model=RetrieveResponse)
def retrieve_semantic(body: TextRetrieveRequest):
    try:
        hits = semantic_retrieve(
            query=body.query,
            project_id=body.project_id,
            title=body.title,
            created_from=body.created_from,
            created_to=body.created_to,
            limit=body.limit,
        )
    except Exception as exc:
        raise HTTPException(502, f"Semantic retrieval failed: {exc}") from exc
    return {"hits": hits, "strategy": "semantic"}


@app.post("/retrieve/hybrid", response_model=RetrieveResponse)
def retrieve_hybrid(body: TextRetrieveRequest):
    try:
        hits = hybrid_retrieve(
            query=body.query,
            project_id=body.project_id,
            title=body.title,
            created_from=body.created_from,
            created_to=body.created_to,
            limit=body.limit,
        )
    except Exception as exc:
        raise HTTPException(502, f"Hybrid retrieval failed: {exc}") from exc
    return {"hits": hits, "strategy": "hybrid"}


# --- RAG ----------------------------------------------------------------------


RAG_SYSTEM = """You answer questions using only the numbered chunks from RecallDB.
Cite supporting chunks inline as [chunk:<id>].
If the chunks are insufficient, say so and do not invent facts.
Be concise and specific.
"""


@app.post("/rag", response_model=RagResponse)
def rag(body: RagRequest):
    try:
        hits = hybrid_retrieve(body.question, project_id=body.project_id, limit=body.limit)
    except Exception as exc:
        raise HTTPException(502, f"Retrieval failed: {exc}") from exc

    if not hits:
        return RagResponse(
            answer="No matching chunks were found. Ingest documents into this project first.",
            citations=[],
        )

    packed = []
    for hit in hits:
        packed.append(
            f"[chunk:{hit['chunk_id']}] {hit['document_title']}\n{hit['content']}"
        )
    user = (
        "Chunks:\n\n"
        + "\n\n---\n\n".join(packed)
        + f"\n\nQuestion: {body.question}"
    )
    try:
        answer = complete(RAG_SYSTEM, user, max_tokens=1024)
    except Exception as exc:
        raise HTTPException(502, f"LLM failed: {exc}") from exc

    citations = [
        Citation(
            chunk_id=hit["chunk_id"],
            document_id=hit["document_id"],
            document_title=hit["document_title"],
            content=hit["content"],
            score=hit["score"],
        )
        for hit in hits
    ]
    return RagResponse(answer=answer, citations=citations)


# --- NL-to-SQL ----------------------------------------------------------------


@app.post("/nl-sql", response_model=NlSqlResponse)
def run_nl_sql(body: NlSqlRequest):
    try:
        sql, columns, rows = nl_to_sql(body.question)
    except SqlValidationError as exc:
        raise HTTPException(400, f"Generated SQL rejected: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, f"NL-to-SQL failed: {exc}") from exc

    safe_rows = [_jsonable_row(row) for row in rows]
    return NlSqlResponse(
        sql=sql, columns=columns, rows=safe_rows, row_count=len(safe_rows)
    )
