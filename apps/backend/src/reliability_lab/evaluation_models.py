from typing import Literal

from reliability_lab.domain import AgentAnswer, StrictModel
from reliability_lab.evaluation import TestCase


class Rate(StrictModel):
    numerator: int
    denominator: int
    value: float | None


class Latencies(StrictModel):
    median: float | None
    p95: float | None
    mean: float | None
    values: list[float]


class Summary(StrictModel):
    tests_completed: int
    tests_passed: int
    pass_rate: Rate
    failure_rate: Rate
    metrics: dict[str, Rate]
    failures_by_category: dict[str, int]
    latency_ms: Latencies
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost_usd: float | None


class CaseResult(StrictModel):
    test_id: str
    category: str
    question: str
    expected: TestCase
    answer: AgentAnswer | None
    error: str | None
    latency_ms: float
    passed: bool
    checks: dict[str, bool]
    metrics: dict[str, Rate]


class RunSummary(StrictModel):
    id: str
    created_at: str
    status: Literal["queued", "running", "completed", "failed", "interrupted"]
    dataset_id: str
    dataset_version: str
    dataset_hash: str
    fixture_hash: str
    metric_version: str
    top_k: int
    label: str
    provider: str
    model: str
    simulated: bool
    total_tests: int
    summary: Summary | None
    error: str | None


class RunDetail(RunSummary):
    results: list[CaseResult]


class DatasetInfo(StrictModel):
    id: str
    version: str
    description: str
    test_count: int


class FailureInfo(StrictModel):
    run_id: str
    test_id: str
    category: str
    question: str


class OverviewInfo(StrictModel):
    run_count: int
    latest_run: RunSummary | None
    metric_run: RunSummary | None
    recent_failures: list[FailureInfo]
