from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Fact(StrictModel):
    subject: str
    predicate: str
    value: str
    quote: str


class Record(StrictModel):
    id: str
    title: str
    kind: Literal["plan", "meeting", "task", "decision", "note"]
    body: str
    facts: list[Fact] = Field(default_factory=list)
    url: str | None = None


class QueryRequest(StrictModel):
    question: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=4, ge=1, le=10)
    source: Literal["synthetic", "notion"] = "synthetic"
    provider: Literal["mock", "openai"] = "mock"


class Citation(StrictModel):
    record_id: str
    quote: str


class Claim(StrictModel):
    text: str
    citations: list[Citation]


class AgentAnswer(StrictModel):
    answer: str
    claims: list[Claim] = Field(default_factory=list)
    abstained: bool = False
    reason: Literal[
        "answered", "insufficient_evidence", "conflicting_evidence", "action_requires_confirmation"
    ]
    sources: list[Record] = Field(default_factory=list)
    provider: str = "mock"
    simulated: bool = True
    latency_ms: float = 0
    input_tokens: int | None = None
    output_tokens: int | None = None
    estimated_cost_usd: float | None = None
