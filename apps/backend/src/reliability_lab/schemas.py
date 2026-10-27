from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from reliability_lab.config import default_provider


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: Literal["agent-reliability-lab"] = "agent-reliability-lab"
    status: Literal["ok"] = "ok"
    mode: Literal["mock", "live"] = Field(
        default_factory=lambda: "mock" if default_provider() == "mock" else "live"
    )
    version: Literal["0.1.1"] = "0.1.1"


class ErrorResponse(BaseModel):
    code: str
    message: str
