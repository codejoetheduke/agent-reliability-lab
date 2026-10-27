import asyncio

import httpx
import pytest

from reliability_lab.domain import AgentAnswer, Citation, Claim
from reliability_lab.evaluation import (
    TestCase as Case,
)
from reliability_lab.evaluation import (
    aggregate,
    execute_case,
    load_dataset,
    percentile,
    score,
)
from reliability_lab.evaluation_service import RunRequest, perform_run, prepare_run
from reliability_lab.main import app
from reliability_lab.storage import Store
from reliability_lab.workspace import SyntheticWorkspace


@pytest.mark.parametrize("case", load_dataset().cases, ids=lambda case: case.id)
def test_labeled_synthetic_scenario(case):
    result = asyncio.run(execute_case(case))
    assert result["passed"], result["checks"]


def test_metrics_match_hand_calculated_half_recall_precision_and_support():
    records = asyncio.run(SyntheticWorkspace().records())[:2]
    quote = records[0].facts[1].quote
    answer = AgentAnswer(
        answer=quote,
        reason="answered",
        sources=records,
        claims=[
            Claim(text=quote, citations=[Citation(record_id="atlas-plan", quote=quote)]),
            Claim(text="Unsupported", citations=[Citation(record_id="missing", quote="Invented")]),
        ],
    )
    result = score(
        Case(
            id="manual",
            category="manual",
            question="owner",
            expected_sources=["atlas-plan", "atlas-task"],
        ),
        answer,
        top_k=2,
    )
    for metric in [
        "recall_at_k",
        "precision_at_k",
        "extractive_claim_support",
        "citation_correctness",
    ]:
        assert result["metrics"][metric] == {"numerator": 1, "denominator": 2, "value": 0.5}
    assert not result["passed"]


def test_unavailable_metrics_do_not_inflate_aggregate_denominators():
    answer = AgentAnswer(answer="Unknown", abstained=True, reason="insufficient_evidence")
    case = Case(
        id="missing",
        category="missing",
        question="Unknown",
        expected_reason="insufficient_evidence",
    )
    outcome = score(case, answer)
    summary = aggregate(
        [
            {
                **outcome,
                "latency_ms": 10,
                "category": "missing",
                "answer": answer.model_dump(),
                "error": None,
            }
        ]
    )
    assert summary["metrics"]["required_sources_retrieved"]["value"] is None
    assert summary["metrics"]["citation_correctness"]["value"] is None
    assert summary["estimated_cost_usd"] is None
    assert summary["pass_rate"]["value"] == 1
    assert percentile([10, 20, 30, 40], 0.5) == 25
    assert percentile([10, 20, 30, 40], 0.95) == 38.5


def test_sqlite_history_survives_reopen_and_recovers_interrupted_run(tmp_path):
    store = Store(tmp_path / "history.db")
    run = asyncio.run(prepare_run(RunRequest(), store))
    reopened = Store(tmp_path / "history.db")
    assert reopened.run(run["id"])["status"] == "queued"
    reopened.recover()
    assert reopened.run(run["id"])["status"] == "interrupted"
    reopened.delete_history()
    assert reopened.list_runs() == []


def test_active_runs_prevent_history_deletion(tmp_path):
    store = Store(tmp_path / "history.db")
    run = asyncio.run(prepare_run(RunRequest(), store))
    with pytest.raises(ValueError):
        store.delete_history()
    asyncio.run(perform_run(run["id"], store))
    complete = store.run(run["id"])
    assert complete["status"] == "completed"
    assert complete["summary"]["tests_completed"] == 20
    assert complete["summary"]["tests_passed"] == 20


def test_run_api_validates_and_exposes_inspectable_results():
    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            assert len((await client.get("/datasets")).json()) == 1
            assert (await client.post("/runs", json={"dataset_id": "missing"})).status_code == 400
            assert (await client.post("/runs", json={"top_k": 99})).status_code == 422
            response = await client.post("/runs", json={})
            assert response.status_code == 202
            run_id = response.json()["id"]
            run = (await client.get(f"/runs/{run_id}")).json()
            assert run["status"] == "completed"
            assert len(run["results"]) == 20
            assert (await client.get(f"/runs/{run_id}/tests/atlas-owner")).json()["passed"]
            assert (await client.get("/runs")).json()[0]["id"] == run_id
            assert (await client.delete("/history")).json()["deleted"]
            assert (await client.get("/runs/missing")).status_code == 404

    asyncio.run(check())
