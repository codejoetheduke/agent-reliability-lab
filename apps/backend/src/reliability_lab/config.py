import json
import math
import os
from dataclasses import dataclass
from pathlib import Path

from pydantic import SecretStr

from reliability_lab.domain import StrictModel


class ConfigStatus(StrictModel):
    default_provider: str = "gemini"
    gemini_configured: bool = False
    gemini_model: str = "gemini-3.5-flash-lite"
    openai_configured: bool
    openai_model: str
    mock_available: bool
    notion_configured: bool
    notion_scope_count: int
    notion_read_only: bool
    pricing_configured: bool
    provider_timeout_seconds: float
    history_storage: str
    credentials_in_frontend: bool
    notion_api_version: str = "2026-03-11"


@dataclass(frozen=True)
class Settings:
    openai_key: SecretStr
    model: str
    timeout_seconds: float
    input_price: float | None
    output_price: float | None


@dataclass(frozen=True)
class GeminiSettings:
    """Backend-only Gemini settings; never serialize this object to an API response."""

    key: SecretStr
    model: str
    timeout_seconds: float
    input_price: float | None
    output_price: float | None
    request_interval_seconds: float = 0


def private_configuration() -> dict[str, str]:
    configured = os.environ.get("LAB_CREDENTIALS_FILE")
    if configured == "":
        return {}
    path = (
        Path(configured)
        if configured
        else Path.home() / ".agent-reliability-lab" / "credentials.json"
    )
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise ValueError("Private backend configuration could not be loaded.") from exc
    if not isinstance(data, dict) or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in data.items()
    ):
        raise ValueError("Private backend configuration must contain string settings.")
    return data


def setting(name: str, default: str = "") -> str:
    return os.environ.get(name, private_configuration().get(name, default))


def optional_price(name: str) -> float | None:
    value = setting(name)
    if not value:
        return None
    number = float(value)
    if number < 0 or not math.isfinite(number):
        raise ValueError("Configured pricing must be a finite nonnegative number.")
    return number


def get_settings() -> Settings:
    timeout = float(setting("LAB_PROVIDER_TIMEOUT_SECONDS", "30"))
    if not 0.1 <= timeout <= 120:
        raise ValueError("Provider timeout must be between 0.1 and 120 seconds.")
    return Settings(
        SecretStr(setting("OPENAI_API_KEY")),
        setting("OPENAI_MODEL", "gpt-4.1-mini"),
        timeout,
        optional_price("OPENAI_INPUT_USD_PER_MILLION"),
        optional_price("OPENAI_OUTPUT_USD_PER_MILLION"),
    )


def default_provider() -> str:
    """Live mode is the default. Offline simulations require an explicit choice."""
    provider = setting("LAB_DEFAULT_PROVIDER", "gemini")
    if provider not in {"gemini", "openai", "mock"}:
        raise ValueError("LAB_DEFAULT_PROVIDER must be gemini, openai, or mock.")
    return provider


def get_gemini_settings() -> GeminiSettings:
    timeout = float(setting("LAB_PROVIDER_TIMEOUT_SECONDS", "30"))
    if not 0.1 <= timeout <= 120:
        raise ValueError("Provider timeout must be between 0.1 and 120 seconds.")
    interval = float(setting("LAB_GEMINI_REQUEST_INTERVAL_SECONDS", "7"))
    if not 0 <= interval <= 120:
        raise ValueError("Gemini request interval must be between 0 and 120 seconds.")
    return GeminiSettings(
        SecretStr(setting("GEMINI_API_KEY", setting("GOOGLE_API_KEY"))),
        setting("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        timeout,
        optional_price("GEMINI_INPUT_USD_PER_MILLION"),
        optional_price("GEMINI_OUTPUT_USD_PER_MILLION"),
        interval,
    )


def public_config() -> dict:
    settings = get_settings()
    gemini = get_gemini_settings()
    pricing = gemini if default_provider() == "gemini" else settings
    return {
        "default_provider": default_provider(),
        "gemini_configured": bool(gemini.key.get_secret_value()),
        "gemini_model": gemini.model,
        "openai_configured": bool(settings.openai_key.get_secret_value()),
        "openai_model": settings.model,
        "mock_available": True,
        "notion_configured": bool(setting("NOTION_API_KEY") and setting("NOTION_ROOT_PAGE_IDS")),
        "notion_scope_count": len(
            [item for item in setting("NOTION_ROOT_PAGE_IDS").split(",") if item.strip()]
        ),
        "notion_read_only": True,
        "pricing_configured": pricing.input_price is not None and pricing.output_price is not None,
        "provider_timeout_seconds": settings.timeout_seconds,
        "history_storage": "SQLite local history",
        "credentials_in_frontend": False,
    }
