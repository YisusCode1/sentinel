"""Environment-based configuration for the AI engine."""

from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIEngineSettings(BaseSettings):
    """Gemini settings, allowing startup without an API key."""

    GEMINI_API_KEY: SecretStr | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: float = 15.0

    INTERNAL_SERVICE_KEY: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=(".env", str(Path(__file__).resolve().parent.parent / ".env")),
        extra="ignore",
    )


def get_settings() -> AIEngineSettings:
    """Load settings from environment variables and the local .env file."""
    return AIEngineSettings()
