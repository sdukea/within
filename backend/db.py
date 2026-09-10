"""psycopg3 connection pool and schema migration. No ORM."""

from contextlib import contextmanager
from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector
from psycopg import ClientCursor
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

pool: ConnectionPool | None = None


def _configure_connection(conn):
    """Register pgvector adapters on every pooled connection."""
    register_vector(conn)


def init_pool() -> None:
    global pool
    pool = ConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row, "autocommit": False},
        configure=_configure_connection,
        open=True,
    )


def close_pool() -> None:
    global pool
    if pool is not None:
        pool.close()
        pool = None


def migrate() -> None:
    """Apply schema.sql. ClientCursor uses the simple query protocol so the
    full script (functions contain semicolons) can run as one batch."""
    sql = SCHEMA_PATH.read_text()
    with psycopg.connect(
        settings.database_url,
        autocommit=True,
        cursor_factory=ClientCursor,
    ) as conn:
        conn.execute(sql)


@contextmanager
def get_conn():
    if pool is None:
        raise RuntimeError("Database pool is not initialized")
    with pool.connection() as conn:
        yield conn
