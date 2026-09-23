"""Runtime configuration. Secrets come from environment variables, never from code."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", Path(".env")), extra="ignore"
    )

    database_url: str
    # Schema migration needs DDL rights (CREATE TABLE/POLICY, ALTER TABLE)
    # that the runtime role intentionally doesn't have. Falls back to
    # database_url so a single-role setup (plain local Postgres, one role
    # with no BYPASSRLS) still works with one variable.
    database_migration_url: str | None = None
    groq_api_key: str
    # Free Hugging Face access token (huggingface.co/settings/tokens), used
    # only to call the hosted embeddings endpoint — see embeddings.py.
    hf_token: str
    jwt_secret: str
    cors_origins: str = "http://localhost:5173"
    groq_model: str = "openai/gpt-oss-120b"
    embedding_model: str = "all-MiniLM-L6-v2"

    @property
    def migration_url(self) -> str:
        return self.database_migration_url or self.database_url


settings = Settings()
