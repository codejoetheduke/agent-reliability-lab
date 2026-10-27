"""Versioned, explicitly labeled scoring. No LLM judge or inferred accuracy."""

import hashlib
import json
from collections import Counter
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any

from pydantic import Field

from reliability_lab.agent import Agent
from reliability_lab.domain import AgentAnswer, QueryRequest, StrictModel
from reliability_lab.providers import FaultProvider, ProviderError, get_provider
from reliability_lab.workspace import SyntheticWorkspace

METRIC_VERSION = "extractive-v1"


class TestCase(StrictModel):
    id: str
    category: str
    question: str
    fixture_ids: list[str] | None = None
    expected_sources: list[str] = Field(default_factory=list)
    expected_text: list[str] = Field(default_factory=list)
    expected_reason: str = "answered"
    safety_requirements: list[str] = Field(default_factory=lambda: ["no_mutation"])
    fault: str | None = None
    expected_error: str | None = None


class Dataset(StrictModel):
    id: str
    version: str
    description: str
    cases: list[TestCase]


def load_dataset(dataset_id: str = "synthetic-v1") -> Dataset:
    if dataset_id != "synthetic-v1":
        raise ValueError("Unknown evaluation dataset.")
    path = Path(__file__).parent / "fixtures" / "evaluation-v1.json"
    return Dataset.model_validate_json(path.read_text())


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def fraction(numerator: int, denominator: int) -> dict:
    return {
        "numerator": numerator,
        "denominator": denominator,
        "value": numerator / denominator if denominator else None,
    }


def score(case: TestCase, answer: AgentAnswer, top_k: int = 4) -> dict:
    retrieved = {record.id for record in answer.sources}
    expected = set(case.expected_sources)
    relevant = len(retrieved & expected)
    records = {record.id: record for record in answer.sources}
    citations = [citation for claim in answer.claims for citation in claim.citations]

    def valid(c):
        return (
            bool(c.quote.strip())
            and c.record_id in records
            and c.quote in records[c.record_id].body
        )

    support = sum(
        bool(claim.citations) and any(valid(c) and claim.text == c.quote for c in claim.citations)
        for claim in answer.claims
    )
    checks = {
        "expected_reason": answer.reason == case.expected_reason,
        "expected_text": all(text.lower() in answer.answer.lower() for text in case.expected_text),
        "valid_citations": all(valid(citation) for citation in citations),
        "no_unsupported_claims": support == len(answer.claims),
        "expected_abstention": answer.abstained == (case.expected_reason != "answered"),
        "required_sources": expected <= retrieved,
    }
    metrics = {
        "recall_at_k": fraction(relevant, len(expected)),
        "precision_at_k": fraction(relevant, top_k),
        "required_sources_retrieved": fraction(
            int(expected <= retrieved) if expected else 0, 1 if expected else 0
        ),
        "citation_correctness": fraction(sum(valid(c) for c in citations), len(citations)),
        "extractive_claim_support": fraction(support, len(answer.claims)),
        "labeled_answer_checks": fraction(
            int(checks["expected_reason"] and checks["expected_text"]), 1
        ),
        "appropriate_abstention": fraction(
            int(answer.abstained) if case.expected_reason != "answered" else 0,
            1 if case.expected_reason != "answered" else 0,
        ),
    }
    return {"passed": all(checks.values()), "checks": checks, "metrics": metrics}


def percentile(values: list[float], proportion: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    position = (len(values) - 1) * proportion
    left = int(position)
    right = min(left + 1, len(values) - 1)
    return values[left] + (values[right] - values[left]) * (position - left)


def aggregate(results: list[dict]) -> dict:
    keys = {name for result in results for name in result.get("metrics", {})}
    metrics = {}
    for key in sorted(keys):
        rows = [result["metrics"][key] for result in results if key in result.get("metrics", {})]
        metrics[key] = fraction(
            sum(item["numerator"] for item in rows), sum(item["denominator"] for item in rows)
        )
    failures = Counter(result["category"] for result in results if not result["passed"])
    latencies = [result["latency_ms"] for result in results]
    usage = [result["answer"] for result in results if result.get("answer")]
    return {
        "tests_completed": len(results),
        "tests_passed": sum(result["passed"] for result in results),
        "pass_rate": fraction(sum(result["passed"] for result in results), len(results)),
        "failure_rate": fraction(
            sum(result.get("error") is not None for result in results), len(results)
        ),
        "provider_failure_rate": fraction(
            sum(
                result.get("error") is not None
                for result in results
                if not result.get("fault_injected")
            ),
            sum(not result.get("fault_injected") for result in results),
        ),
        "injected_faults": sum(bool(result.get("fault_injected")) for result in results),
        "metrics": metrics,
        "failures_by_category": dict(failures),
        "latency_ms": {
            "median": percentile(latencies, 0.5),
            "p95": percentile(latencies, 0.95),
            "mean": mean(latencies) if latencies else None,
            "values": latencies,
        },
        "input_tokens": sum(a["input_tokens"] for a in usage)
        if usage and all(a["input_tokens"] is not None for a in usage)
        else None,
        "output_tokens": sum(a["output_tokens"] for a in usage)
        if usage and all(a["output_tokens"] is not None for a in usage)
        else None,
        "estimated_cost_usd": sum(a["estimated_cost_usd"] for a in usage)
        if usage and all(a["estimated_cost_usd"] is not None for a in usage)
        else None,
    }


async def execute_case(
    case: TestCase, top_k: int = 4, provider: str = "mock", model: str | None = None
) -> dict:
    all_records = await SyntheticWorkspace().records()
    selected = (
        all_records
        if case.fixture_ids is None
        else [record for record in all_records if record.id in case.fixture_ids]
    )
    started = perf_counter()
    try:
        adapter = FaultProvider(case.fault) if case.fault else get_provider(provider, model)
        answer = await Agent(SyntheticWorkspace(selected), adapter).query(
            QueryRequest(question=case.question, top_k=top_k)
        )
    except ProviderError as exc:
        return {
            "test_id": case.id,
            "category": case.category,
            "question": case.question,
            "expected": case.model_dump(),
            "answer": None,
            "error": exc.code,
            "latency_ms": round((perf_counter() - started) * 1000, 3),
            "passed": exc.code == case.expected_error,
            "checks": {"expected_safe_error": exc.code == case.expected_error},
            "metrics": {},
            "fault_injected": bool(case.fault),
        }
    outcome = score(case, answer, top_k)
    if case.expected_error:
        outcome["passed"] = False
        outcome["checks"]["expected_safe_error"] = False
    return {
        "test_id": case.id,
        "category": case.category,
        "question": case.question,
        "expected": case.model_dump(),
        "answer": answer.model_dump(),
        "error": None,
        "fault_injected": bool(case.fault),
        "latency_ms": round((perf_counter() - started) * 1000, 3),
        **outcome,
    }
