"""Within API: the database is the product; the LLM is a layer on top."""

import json
import re
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from psycopg.types.json import Json

from auth import create_access_token, get_current_user, hash_password, verify_password
from config import settings
from db import close_pool, get_conn, get_user_conn, init_pool, migrate
from extract import ExtractionError, extract_text
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
    AuthRequest,
    Citation,
    DocumentCreate,
    DocumentDetail,
    DocumentOut,
    IngestRequest,
    IngestResponse,
    InteractionOut,
    NlSqlRequest,
    NlSqlResponse,
    ProjectCreate,
    ProjectOut,
    RagRequest,
    RagResponse,
    RetrieveResponse,
    StructuredRetrieveRequest,
    TextRetrieveRequest,
    TokenResponse,
    UserOut,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    migrate()
    yield
    close_pool()


app = FastAPI(title="Within", lifespan=lifespan)
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


# --- Auth -----------------------------------------------------------------


@app.post("/auth/register", response_model=TokenResponse)
def register(body: AuthRequest):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = %s", (body.email,)
        ).fetchone()
        if existing is not None:
            raise HTTPException(409, "An account with that email already exists")
        user = conn.execute(
            """
            INSERT INTO users (email, password_hash)
            VALUES (%s, %s)
            RETURNING id, email, created_at
            """,
            (body.email, hash_password(body.password)),
        ).fetchone()
        conn.commit()
    return TokenResponse(token=create_access_token(user["id"]), user=user)


@app.post("/auth/login", response_model=TokenResponse)
def login(body: AuthRequest):
    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, email, created_at, password_hash FROM users WHERE email = %s",
            (body.email,),
        ).fetchone()
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return TokenResponse(token=create_access_token(user["id"]), user=user)


@app.get("/auth/me", response_model=UserOut)
def me(user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, email, created_at FROM users WHERE id = %s", (user_id,)
        ).fetchone()
    if user is None:
        raise HTTPException(401, "Session no longer valid")
    return user


# --- Projects -----------------------------------------------------------------


@app.post("/projects", response_model=ProjectOut)
def create_project(body: ProjectCreate, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
        row = conn.execute(
            """
            INSERT INTO projects (name, description, owner_id)
            VALUES (%s, %s, %s)
            RETURNING id, name, description, created_at
            """,
            (body.name, body.description, user_id),
        ).fetchone()
        conn.commit()
    return {**row, "document_count": 0}


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
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
def get_project(project_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
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
def delete_project(project_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
        row = conn.execute(
            "DELETE FROM projects WHERE id = %s RETURNING id", (project_id,)
        ).fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(404, "Project not found")
    return {"deleted": True, "id": project_id}


# --- Documents ----------------------------------------------------------------


@app.post("/documents", response_model=DocumentOut)
def create_document(body: DocumentCreate, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
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
def list_documents(project_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
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
def get_document(document_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
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


@app.get("/documents/{document_id}/content", response_model=DocumentDetail)
def get_document_content(document_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
        doc = conn.execute(
            "SELECT id, project_id, title, source, created_at FROM documents WHERE id = %s",
            (document_id,),
        ).fetchone()
        if doc is None:
            raise HTTPException(404, "Document not found")
        chunks = conn.execute(
            """
            SELECT id, chunk_index, content
            FROM document_chunks
            WHERE document_id = %s
            ORDER BY chunk_index ASC
            """,
            (document_id,),
        ).fetchall()
    return {**doc, "chunks": chunks}


@app.delete("/documents/{document_id}")
def delete_document(document_id: int, user_id: int = Depends(get_current_user)):
    with get_user_conn(user_id) as conn:
        row = conn.execute(
            "DELETE FROM documents WHERE id = %s RETURNING id", (document_id,)
        ).fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(404, "Document not found")
    return {"deleted": True, "id": document_id}


# --- Ingestion ----------------------------------------------------------------


@app.post("/ingest", response_model=IngestResponse)
def ingest(body: IngestRequest, user_id: int = Depends(get_current_user)):
    try:
        result = ingest_document(user_id, body.project_id, body.title, body.text, body.source)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Ingestion failed: {exc}") from exc
    return result


MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB


@app.post("/ingest/file", response_model=IngestResponse)
async def ingest_file(
    project_id: int = Form(...),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")

    filename = file.filename or "upload"
    try:
        text = extract_text(filename, data)
    except ExtractionError as exc:
        raise HTTPException(400, str(exc)) from exc

    doc_title = (title or "").strip() or Path(filename).stem
    try:
        result = ingest_document(user_id, project_id, doc_title, text, source=filename)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Ingestion failed: {exc}") from exc
    return result


# --- Interaction history --------------------------------------------------


def _log_interaction(
    user_id: int, project_id: int | None, kind: str, request: dict, response: dict
) -> None:
    """Best-effort: a failure to log history should never fail the request
    that produced it."""
    try:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO interactions (project_id, user_id, kind, request, response)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    project_id,
                    user_id,
                    kind,
                    Json(_jsonable_payload(request)),
                    Json(_jsonable_payload(response)),
                ),
            )
            conn.commit()
    except Exception:
        pass


def _jsonable_payload(payload: Any) -> Any:
    return json.loads(json.dumps(payload, default=str))


@app.get("/projects/{project_id}/history", response_model=list[InteractionOut])
def get_history(
    project_id: int,
    kind: Literal["ask", "search", "query"] | None = None,
    limit: int = 50,
    user_id: int = Depends(get_current_user),
):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, project_id, kind, request, response, created_at
            FROM interactions
            WHERE user_id = %(user_id)s AND project_id = %(project_id)s
              AND (%(kind)s::text IS NULL OR kind = %(kind)s)
            ORDER BY created_at DESC
            LIMIT %(limit)s
            """,
            {"user_id": user_id, "project_id": project_id, "kind": kind, "limit": limit},
        ).fetchall()
    return rows


# --- Retrieval (kept as four distinct routes so each strategy is inspectable) --


@app.post("/retrieve/structured", response_model=RetrieveResponse)
def retrieve_structured(body: StructuredRetrieveRequest, user_id: int = Depends(get_current_user)):
    hits = structured_retrieve(
        user_id,
        project_id=body.project_id,
        title=body.title,
        created_from=body.created_from,
        created_to=body.created_to,
        limit=body.limit,
    )
    return {"hits": hits, "strategy": "structured"}


@app.post("/retrieve/fulltext", response_model=RetrieveResponse)
def retrieve_fulltext(body: TextRetrieveRequest, user_id: int = Depends(get_current_user)):
    hits = fulltext_retrieve(
        user_id,
        query=body.query,
        project_id=body.project_id,
        title=body.title,
        created_from=body.created_from,
        created_to=body.created_to,
        limit=body.limit,
    )
    _log_interaction(user_id, body.project_id, "search", body.model_dump(mode="json"), {"hits": [_jsonable_row(h) for h in hits], "strategy": "fulltext"})
    return {"hits": hits, "strategy": "fulltext"}


@app.post("/retrieve/semantic", response_model=RetrieveResponse)
def retrieve_semantic(body: TextRetrieveRequest, user_id: int = Depends(get_current_user)):
    try:
        hits = semantic_retrieve(
            user_id,
            query=body.query,
            project_id=body.project_id,
            title=body.title,
            created_from=body.created_from,
            created_to=body.created_to,
            limit=body.limit,
        )
    except Exception as exc:
        raise HTTPException(502, f"Semantic retrieval failed: {exc}") from exc
    _log_interaction(user_id, body.project_id, "search", body.model_dump(mode="json"), {"hits": [_jsonable_row(h) for h in hits], "strategy": "semantic"})
    return {"hits": hits, "strategy": "semantic"}


@app.post("/retrieve/hybrid", response_model=RetrieveResponse)
def retrieve_hybrid(body: TextRetrieveRequest, user_id: int = Depends(get_current_user)):
    try:
        hits = hybrid_retrieve(
            user_id,
            query=body.query,
            project_id=body.project_id,
            title=body.title,
            created_from=body.created_from,
            created_to=body.created_to,
            limit=body.limit,
        )
    except Exception as exc:
        raise HTTPException(502, f"Hybrid retrieval failed: {exc}") from exc
    _log_interaction(user_id, body.project_id, "search", body.model_dump(mode="json"), {"hits": [_jsonable_row(h) for h in hits], "strategy": "hybrid"})
    return {"hits": hits, "strategy": "hybrid"}


# --- RAG ----------------------------------------------------------------------


RAG_SYSTEM = """You answer questions using only the numbered chunks from Within.
Cite supporting chunks inline as [chunk:<id>], using plain ASCII square
brackets exactly like that example — not full-width or CJK bracket
characters (no （）, 【】, 〔〕, or similar).
If the chunks are insufficient, say so and do not invent facts.
Be concise and specific.
"""

# Some models render citation brackets as full-width/CJK punctuation
# (e.g. "【chunk:7】", "〔chunk:7〕") despite the ASCII instruction above.
# Normalize any bracket style wrapping "chunk:<id>" back to "[chunk:<id>]"
# so the frontend's citation-highlighting regex keeps working regardless.
_CITATION_BRACKETS = re.compile(r"[\[【〔﹝［]\s*chunk:(\d+)\s*[\]】〕﹞］]")


def _normalize_citations(text: str) -> str:
    return _CITATION_BRACKETS.sub(r"[chunk:\1]", text)


@app.post("/rag", response_model=RagResponse)
def rag(body: RagRequest, user_id: int = Depends(get_current_user)):
    try:
        hits = hybrid_retrieve(user_id, body.question, project_id=body.project_id, limit=body.limit)
    except Exception as exc:
        raise HTTPException(502, f"Retrieval failed: {exc}") from exc

    if not hits:
        response = RagResponse(
            answer="No matching chunks were found. Ingest documents into this project first.",
            citations=[],
        )
        _log_interaction(user_id, body.project_id, "ask", body.model_dump(mode="json"), response.model_dump(mode="json"))
        return response

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
        answer = _normalize_citations(complete(RAG_SYSTEM, user, max_tokens=1024))
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
    response = RagResponse(answer=answer, citations=citations)
    _log_interaction(user_id, body.project_id, "ask", body.model_dump(mode="json"), response.model_dump(mode="json"))
    return response


# --- NL-to-SQL ----------------------------------------------------------------


@app.post("/nl-sql", response_model=NlSqlResponse)
def run_nl_sql(body: NlSqlRequest, user_id: int = Depends(get_current_user)):
    try:
        sql, columns, rows = nl_to_sql(body.question, user_id)
    except SqlValidationError as exc:
        raise HTTPException(400, f"Generated SQL rejected: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, f"NL-to-SQL failed: {exc}") from exc

    safe_rows = [_jsonable_row(row) for row in rows]
    response = NlSqlResponse(
        sql=sql, columns=columns, rows=safe_rows, row_count=len(safe_rows)
    )
    _log_interaction(user_id, body.project_id, "query", body.model_dump(mode="json"), response.model_dump(mode="json"))
    return response
