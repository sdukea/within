"""Runtime configuration. Secrets come from environment variables, never from code."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", Path(".env")), extra="ignore"
    )

    database_url: str
    groq_api_key: str
    cors_origins: str = "http://localhost:5173"
    groq_model: str = "openai/gpt-oss-120b"
    embedding_model: str = "all-MiniLM-L6-v2"


settings = Settings()
