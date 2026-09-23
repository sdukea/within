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
    full script (functions contain semicolons) can run as one batch.

    Runs against `migration_url`, not the runtime pool's `database_url`:
    creating tables, altering columns, and defining RLS policies needs
    ownership/DDL rights that the runtime role deliberately doesn't have
    (see get_user_conn's docstring for why that role exists at all).
    """
    sql = SCHEMA_PATH.read_text()
    with psycopg.connect(
        settings.migration_url,
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


@contextmanager
def get_user_conn(user_id: int):
    """A connection with the row-level-security session variable set.

    `projects`, `documents`, and `document_chunks` all have RLS policies
    keyed on `current_setting('app.user_id')` (see schema.sql). Every query
    that touches those tables must go through this instead of `get_conn()`,
    or Postgres will see no `app.user_id` and silently return zero rows for
    anything with a non-null `owner_id`.

    This only works because the runtime pool connects as `within_app`, a
    role created specifically without BYPASSRLS. Neon's default owner role
    (whatever DATABASE_URL uses for migrations) has BYPASSRLS by default —
    a role attribute that ignores RLS unconditionally, `FORCE ROW LEVEL
    SECURITY` included. Running the app as that role would make every
    policy in schema.sql a no-op with no error to notice.

    `set_config(..., true)` is the parameterized equivalent of `SET LOCAL`;
    plain `SET LOCAL x = %s` isn't valid SQL, so this is the only safe way
    to do it with a bound parameter. `true` scopes it to the current
    transaction, so it can never leak to the next request that borrows this
    connection from the pool.
    """
    if pool is None:
        raise RuntimeError("Database pool is not initialized")
    with pool.connection() as conn:
        conn.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
        yield conn
