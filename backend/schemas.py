"""Pydantic request/response models. These are API shapes, not ORM tables."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    token: str
    user: UserOut


class InteractionOut(BaseModel):
    id: int
    project_id: int | None
    kind: Literal["ask", "search", "query"]
    request: dict[str, Any]
    response: dict[str, Any]
    created_at: datetime


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    document_count: int = 0


class DocumentCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1)
    source: str | None = None


class DocumentOut(BaseModel):
    id: int
    project_id: int
    title: str
    source: str | None
    created_at: datetime
    chunk_count: int = 0


class ChunkOut(BaseModel):
    id: int
    chunk_index: int
    content: str


class DocumentDetail(BaseModel):
    id: int
    project_id: int
    title: str
    source: str | None
    created_at: datetime
    chunks: list[ChunkOut]


class IngestRequest(BaseModel):
    project_id: int
    title: str = Field(min_length=1)
    text: str = Field(min_length=1)
    source: str | None = None


class IngestResponse(BaseModel):
    document: DocumentOut
    chunk_count: int


class StructuredRetrieveRequest(BaseModel):
    project_id: int | None = None
    title: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None
    limit: int = Field(default=20, ge=1, le=100)


class TextRetrieveRequest(BaseModel):
    query: str = Field(min_length=1)
    project_id: int | None = None
    title: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None
    limit: int = Field(default=10, ge=1, le=50)


class ChunkHit(BaseModel):
    chunk_id: int
    document_id: int
    document_title: str
    project_id: int
    chunk_index: int
    content: str
    score: float
    created_at: datetime
    rank: int | None = None
    fulltext_rank: int | None = None
    semantic_rank: int | None = None


class RetrieveResponse(BaseModel):
    hits: list[ChunkHit]
    strategy: str


class RagRequest(BaseModel):
    question: str = Field(min_length=1)
    project_id: int | None = None
    limit: int = Field(default=8, ge=1, le=20)


class Citation(BaseModel):
    chunk_id: int
    document_id: int
    document_title: str
    content: str
    score: float


class RagResponse(BaseModel):
    answer: str
    citations: list[Citation]
    strategy: Literal["hybrid"] = "hybrid"


class NlSqlRequest(BaseModel):
    question: str = Field(min_length=1)
    # Not used to scope the generated SQL (NL-to-SQL reads across the whole
    # schema, restricted to the caller's own rows by row-level security) —
    # only to tag which project's history thread this belongs to.
    project_id: int | None = None


class NlSqlResponse(BaseModel):
    sql: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
