import math

from reliability_lab.domain import StrictModel
from reliability_lab.evaluation_models import Rate, RunSummary


class Interval(StrictModel):
    lower: float
    upper: float


class MetricDifference(StrictModel):
    name: str
    left: Rate | None
    right: Rate | None
    delta: float | None


class CaseDifference(StrictModel):
    test_id: str
    category: str
    left_passed: bool
    right_passed: bool
    left_error: str | None
    right_error: str | None


class HistogramBin(StrictModel):
    start_ms: float
    end_ms: float
    left_count: int
    right_count: int


class Comparison(StrictModel):
    comparable: bool
    reasons: list[str]
    warnings: list[str]
    left: RunSummary
    right: RunSummary
    metrics: list[MetricDifference]
    left_pass_interval: Interval | None
    right_pass_interval: Interval | None
    case_differences: list[CaseDifference]
    latency_histogram: list[HistogramBin]
    improved: int
    regressed: int
    unchanged: int


def wilson(successes: int, count: int) -> dict | None:
    if not count:
        return None
    z = 1.959963984540054
    proportion = successes / count
    denominator = 1 + z * z / count
    midpoint = (proportion + z * z / (2 * count)) / denominator
    margin = (
        z * math.sqrt((proportion * (1 - proportion) + z * z / (4 * count)) / count) / denominator
    )
    return {"lower": max(0, midpoint - margin), "upper": min(1, midpoint + margin)}


def histogram(left: list[float], right: list[float], bins: int = 6) -> list[dict]:
    maximum = max(left + right, default=0)
    width = (maximum * 1.000001 or 1) / bins
    result = [
        {
            "start_ms": index * width,
            "end_ms": (index + 1) * width,
            "left_count": 0,
            "right_count": 0,
        }
        for index in range(bins)
    ]
    for name, values in [("left_count", left), ("right_count", right)]:
        for value in values:
            result[min(int(value / width), bins - 1)][name] += 1
    return result


def compare(left: dict, right: dict) -> dict:
    reasons = []
    warnings = []
    if left["id"] == right["id"]:
        reasons.append("Select two different runs.")
    if left["status"] != "completed" or right["status"] != "completed":
        reasons.append("Both runs must be completed.")
    for key in [
        "dataset_id",
        "dataset_version",
        "dataset_hash",
        "fixture_hash",
        "metric_version",
        "top_k",
        "prompt_version",
        "conditions_hash",
        "simulated",
    ]:
        if key not in left or key not in right or left.get(key) is None or right.get(key) is None:
            reasons.append(f"Missing comparison condition: {key}.")
        elif left[key] != right[key]:
            reasons.append(f"Incompatible condition: {key}.")
    for run in [left, right]:
        if not run.get("summary") or len(run.get("results", [])) != run.get("total_tests"):
            reasons.append("A run has missing test outcomes.")
        if len({row["test_id"] for row in run.get("results", [])}) != len(run.get("results", [])):
            reasons.append("A run contains duplicate test identifiers.")
    left_rows = {row["test_id"]: row for row in left.get("results", [])}
    right_rows = {row["test_id"]: row for row in right.get("results", [])}
    if left_rows.keys() != right_rows.keys():
        reasons.append("The completed test identifiers do not match.")

    def public(run):
        return {key: run[key] for key in RunSummary.model_fields if key in run}

    result = {
        "comparable": not reasons,
        "reasons": reasons,
        "warnings": warnings,
        "left": public(left),
        "right": public(right),
        "metrics": [],
        "left_pass_interval": None,
        "right_pass_interval": None,
        "case_differences": [],
        "latency_histogram": [],
        "improved": 0,
        "regressed": 0,
        "unchanged": 0,
    }
    if reasons:
        return result
    for key in sorted(set(left["summary"]["metrics"]) | set(right["summary"]["metrics"])):
        a = left["summary"]["metrics"].get(key)
        b = right["summary"]["metrics"].get(key)
        delta = (
            b["value"] - a["value"]
            if a and b and a["value"] is not None and b["value"] is not None
            else None
        )
        result["metrics"].append({"name": key, "left": a, "right": b, "delta": delta})
    result["left_pass_interval"] = wilson(
        left["summary"]["tests_passed"], left["summary"]["tests_completed"]
    )
    result["right_pass_interval"] = wilson(
        right["summary"]["tests_passed"], right["summary"]["tests_completed"]
    )
    for test_id, a in left_rows.items():
        b = right_rows[test_id]
        if a["passed"] == b["passed"]:
            result["unchanged"] += 1
        elif b["passed"]:
            result["improved"] += 1
        else:
            result["regressed"] += 1
        if a["passed"] != b["passed"] or a.get("error") != b.get("error"):
            result["case_differences"].append(
                {
                    "test_id": test_id,
                    "category": a["category"],
                    "left_passed": a["passed"],
                    "right_passed": b["passed"],
                    "left_error": a.get("error"),
                    "right_error": b.get("error"),
                }
            )
    result["latency_histogram"] = histogram(
        [row["latency_ms"] for row in left_rows.values()],
        [row["latency_ms"] for row in right_rows.values()],
    )
    warnings.append(
        "Wilson 95% intervals are descriptive for curated, correlated cases; "
        "they do not establish statistical significance or population accuracy."
    )
    if left.get("simulated"):
        warnings.append("Both runs are simulated mock workflows, not hosted-model benchmarks.")
    if (
        left["summary"].get("estimated_cost_usd") is None
        or right["summary"].get("estimated_cost_usd") is None
    ):
        warnings.append("Estimated cost is unavailable in one or both runs.")
    return result
