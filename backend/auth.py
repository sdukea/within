"""Email/password auth: bcrypt for storage, a signed JWT for sessions.

The JWT carries only the user id (`sub`) and an expiry — no roles or
claims worth tampering with — so verifying the signature is all
`get_current_user` needs to do. Every route that touches `projects`,
`documents`, or `document_chunks` depends on this and then uses
`db.get_user_conn(user_id)`, which is what actually enforces isolation
(via Postgres row-level security, see schema.sql) — this module only
answers "who is making this request."
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Header, HTTPException

from config import settings

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=14)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash — never let a crash leak into an auth bypass.
        return False


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + TOKEN_TTL,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(401, "Invalid or expired session") from exc


def get_current_user(authorization: str | None = Header(default=None)) -> int:
    """FastAPI dependency: returns the authenticated user's id, or 401s."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Missing bearer token")
    return decode_access_token(token)
