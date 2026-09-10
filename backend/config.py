"""Runtime configuration. Secrets come from environment variables, never from code."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", Path(".env")), extra="ignore"
    )

    database_url: str
    anthropic_api_key: str
    openai_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    anthropic_model: str = "claude-sonnet-4-20250514"
    embedding_model: str = "text-embedding-3-small"


settings = Settings()
