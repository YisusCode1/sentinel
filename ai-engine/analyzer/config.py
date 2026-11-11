"""Environment-based configuration for the AI engine."""

from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIEngineSettings(BaseSettings):
    """Gemini settings, allowing startup without an API key."""

    GEMINI_API_KEY: SecretStr | None = None
    LLM_API_KEY: SecretStr | None = None
    AI_DEMO_FALLBACK: bool = True
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_TIMEOUT_SECONDS: float = 30.0

    INTERNAL_SERVICE_KEY: SecretStr | None = None

    @property
    def provider_key(self) -> str:
        for key in (self.GEMINI_API_KEY, self.LLM_API_KEY):
            if key is not None and key.get_secret_value().strip():
                return key.get_secret_value().strip()
        return ""

    model_config = SettingsConfigDict(
        env_file=(
            ".env",
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env"),
        ),
        extra="ignore",
    )


def get_settings() -> AIEngineSettings:
    """Load settings from environment variables and the local .env file."""
    return AIEngineSettings()
