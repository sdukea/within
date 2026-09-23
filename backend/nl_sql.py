"""NL-to-SQL: generate a read-only SELECT, validate it, then execute it.

The model never gets a chance to write. Validation is defense in depth on
top of SET LOCAL transaction_read_only.
"""

from __future__ import annotations

import re

import sqlparse

from db import get_user_conn
from llm import complete

SCHEMA_FOR_PROMPT = """
Tables (PostgreSQL):

projects(
  id SERIAL PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)

documents(
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id),
  title TEXT,
  source TEXT,
  created_at TIMESTAMPTZ
)

document_chunks(
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id),
  chunk_index INT,
  content TEXT,
  embedding VECTOR(384),   -- do not SELECT this unless asked; it is a long vector
  tsv TSVECTOR,            -- do not SELECT this unless asked
  created_at TIMESTAMPTZ
)

Relationships: projects 1—N documents 1—N document_chunks.
""".strip()

SYSTEM = """You translate questions into a single PostgreSQL SELECT for Within.
Rules:
- Output ONLY SQL. No markdown fences, no commentary.
- One statement. Must be SELECT or WITH ... SELECT.
- Read-only. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, COPY, CALL.
- Only reference tables: projects, documents, document_chunks.
- Prefer LIMIT 100 unless the user asks for a count/aggregate.
- Use ILIKE for case-insensitive text match.
- Do not select embedding or tsv unless the user explicitly asks.
"""

FORBIDDEN = re.compile(
    r"\b("
    r"insert|update|delete|drop|alter|truncate|create|grant|revoke|"
    r"copy|execute|call|do|comment|listen|notify|lock|vacuum|"
    r"reindex|cluster|refresh|security|into|pg_sleep|lo_|dblink|"
    r"pg_read|pg_write|set\s+role|set\s+session"
    r")\b",
    re.IGNORECASE,
)

ALLOWED_TABLES = {"projects", "documents", "document_chunks"}


class SqlValidationError(ValueError):
    pass


def strip_sql(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:sql)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip().rstrip(";").strip()


def validate_readonly_select(sql: str) -> str:
    """Reject anything that is not a single read-only SELECT against known tables."""
    sql = strip_sql(sql)
    if not sql:
        raise SqlValidationError("Empty SQL")
    if ";" in sql:
        raise SqlValidationError("Multiple statements are not allowed")

    statements = sqlparse.parse(sql)
    if len(statements) != 1:
        raise SqlValidationError("Exactly one SQL statement is required")

    stmt_type = statements[0].get_type()
    if stmt_type != "SELECT":
        raise SqlValidationError(f"Only SELECT is allowed, got {stmt_type or 'unknown'}")

    if FORBIDDEN.search(sql):
        raise SqlValidationError("Statement contains a forbidden keyword")

    cte_names = {
        name.lower()
        for name in re.findall(
            r"(?:with|,)\s*([a-z_][a-z0-9_]*)\s+as\s*\(", sql, flags=re.IGNORECASE
        )
    }
    from_join = re.findall(
        r"\b(?:from|join)\s+([a-z_][a-z0-9_]*)", sql, flags=re.IGNORECASE
    )
    for table in from_join:
        if table.lower() not in ALLOWED_TABLES and table.lower() not in cte_names:
            raise SqlValidationError(f"Table {table!r} is not in the allowed schema")

    return sql


def generate_sql(question: str) -> str:
    """Ask the model for a SELECT, then validate it."""
    user = f"{SCHEMA_FOR_PROMPT}\n\nQuestion:\n{question}"
    raw = complete(SYSTEM, user, max_tokens=512)
    return validate_readonly_select(raw)


def execute_readonly(sql: str, user_id: int) -> tuple[list[str], list[dict]]:
    """Run validated SQL in a read-only transaction with a statement timeout.

    The model wrote this SQL. `get_user_conn` sets the row-level-security
    session variable before it runs, so even a query that's a valid,
    innocent-looking SELECT — but omits a WHERE clause the model should
    have included — still can't return another account's rows. That's
    enforced by Postgres here, not by anything this function checks.
    """
    with get_user_conn(user_id) as conn:
        conn.execute("SET LOCAL statement_timeout = '5000'")
        conn.execute("SET LOCAL transaction_read_only = on")
        result = conn.execute(sql)
        columns = [col.name for col in result.description] if result.description else []
        rows = result.fetchall()
        conn.commit()
    # dict_row already returns dicts; stringify non-JSON-friendly values in the API layer.
    return columns, list(rows)


def nl_to_sql(question: str, user_id: int) -> tuple[str, list[str], list[dict]]:
    """Generate, validate, and execute. Returns (sql, columns, rows)."""
    sql = generate_sql(question)
    columns, rows = execute_readonly(sql, user_id)
    return sql, columns, rows
