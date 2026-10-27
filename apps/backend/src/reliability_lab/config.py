import json
import math
import os
from dataclasses import dataclass
from pathlib import Path

from pydantic import SecretStr


@dataclass(frozen=True)
class Settings:
    openai_key: SecretStr
    model: str
    timeout_seconds: float
    input_price: float | None
    output_price: float | None


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


def public_config() -> dict:
    settings = get_settings()
    return {
        "openai_configured": bool(settings.openai_key.get_secret_value()),
        "openai_model": settings.model,
        "mock_available": True,
        "notion_configured": False,
        "notion_scope_count": 0,
        "notion_read_only": True,
        "pricing_configured": settings.input_price is not None
        and settings.output_price is not None,
        "provider_timeout_seconds": settings.timeout_seconds,
        "history_storage": "SQLite local history",
        "credentials_in_frontend": False,
    }
