from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: Literal["agent-reliability-lab"] = "agent-reliability-lab"
    status: Literal["ok"] = "ok"
    mode: Literal["mock"] = "mock"
    version: Literal["0.1.0"] = "0.1.0"


class ErrorResponse(BaseModel):
    code: str
    message: str
