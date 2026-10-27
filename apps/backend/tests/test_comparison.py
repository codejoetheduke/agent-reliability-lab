import asyncio
from copy import deepcopy

import httpx
import pytest

from reliability_lab.comparison import Comparison, compare, histogram, wilson
from reliability_lab.evaluation_service import RunRequest, perform_run, prepare_run
from reliability_lab.main import app
from reliability_lab.storage import Store
from reliability_lab.workspace import SyntheticWorkspace


def completed(store, **kwargs):
    run = asyncio.run(prepare_run(RunRequest(**kwargs), store))
    asyncio.run(perform_run(run["id"], store))
    return store.run(run["id"])


def test_wilson_and_histogram_match_hand_calculations():
    interval = wilson(9, 10)
    assert interval["lower"] == pytest.approx(0.59585, abs=0.00001)
    assert interval["upper"] == pytest.approx(0.98212, abs=0.00001)
    assert wilson(0, 0) is None
    bins = histogram([0, 10, 20], [5, 20], 2)
    assert [item["left_count"] for item in bins] == [2, 1]
    assert [item["right_count"] for item in bins] == [1, 1]


def test_comparison_requires_matching_conditions_and_complete_cases(tmp_path):
    store = Store(tmp_path / "comparison.db")
    left = completed(store)
    right = completed(store)
    result = Comparison.model_validate(compare(left, right))
    assert result.comparable
    assert result.unchanged == 29
    assert result.improved == result.regressed == 0
    assert sum(item.left_count for item in result.latency_histogram) == 29
    assert all(item.delta in (0, None) for item in result.metrics)
    assert not compare(left, left)["comparable"]
    for field in ["top_k", "fixture_hash", "metric_version", "dataset_hash", "conditions_hash"]:
        modified = deepcopy(right)
        modified[field] = "different"
        assert not compare(left, modified)["comparable"]
    for field in ["conditions_hash", "prompt_version"]:
        modified = deepcopy(right)
        del modified[field]
        assert not compare(left, modified)["comparable"]
    modified = deepcopy(right)
    modified["results"].pop()
    assert not compare(left, modified)["comparable"]
    right["results"][0]["passed"] = False
    right["summary"]["tests_passed"] -= 1
    assert compare(left, right)["regressed"] == 1


def test_run_uses_saved_fixture_and_dataset_snapshots(tmp_path, monkeypatch):
    store = Store(tmp_path / "snapshots.db")
    run = asyncio.run(prepare_run(RunRequest(), store))

    original = SyntheticWorkspace.__init__

    def saved_only(self, records=None):
        assert records is not None, "Mutable fixture file must not be reloaded"
        original(self, records)

    monkeypatch.setattr(SyntheticWorkspace, "__init__", saved_only)
    monkeypatch.setattr(
        "reliability_lab.evaluation_service.load_dataset",
        lambda _: pytest.fail("Mutable dataset file must not be reloaded"),
    )
    asyncio.run(perform_run(run["id"], store))
    result = store.run(run["id"])
    assert result["status"] == "completed"
    assert result["summary"]["tests_passed"] == 29
    assert "fixture_snapshot" not in store.list_runs()[0]


def test_authenticated_comparison_api():
    async def check():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            left = (await client.post("/runs", json={})).json()
            right = (await client.post("/runs", json={})).json()
            response = await client.get(
                "/comparisons", params={"left_id": left["id"], "right_id": right["id"]}
            )
            assert response.status_code == 200
            assert response.json()["comparable"]
            assert "fixture_snapshot" not in response.json()["left"]
            assert (
                await client.get(
                    "/comparisons", params={"left_id": "missing", "right_id": right["id"]}
                )
            ).status_code == 404

    asyncio.run(check())
