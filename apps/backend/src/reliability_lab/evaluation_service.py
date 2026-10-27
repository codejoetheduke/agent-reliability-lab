from pydantic import Field

from reliability_lab.domain import StrictModel
from reliability_lab.evaluation import METRIC_VERSION, aggregate, digest, execute_case, load_dataset
from reliability_lab.storage import Store
from reliability_lab.workspace import SyntheticWorkspace


class RunRequest(StrictModel):
    dataset_id: str = "synthetic-v1"
    top_k: int = Field(default=4, ge=1, le=10)
    label: str = Field(default="Mock baseline", min_length=1, max_length=80)


async def prepare_run(request: RunRequest, store: Store) -> dict:
    dataset = load_dataset(request.dataset_id)
    fixtures = [record.model_dump() for record in await SyntheticWorkspace().records()]
    return store.create_run(
        {
            "dataset_id": dataset.id,
            "dataset_version": dataset.version,
            "dataset_hash": digest(dataset.model_dump()),
            "fixture_hash": digest(fixtures),
            "metric_version": METRIC_VERSION,
            "top_k": request.top_k,
            "label": request.label,
            "provider": "mock",
            "model": "extractive-mock-v1",
            "simulated": True,
            "total_tests": len(dataset.cases),
        }
    )


async def perform_run(run_id: str, store: Store):
    run = store.run(run_id)
    if run is None:
        return
    run["status"] = "running"
    store.save_run(run)
    try:
        for case in load_dataset(run["dataset_id"]).cases:
            result = await execute_case(case, run["top_k"])
            run["results"].append(result)
            run["summary"] = aggregate(run["results"])
            store.save_run(run)
        run["status"] = "completed"
    except Exception:
        run.update(
            status="failed", error="The evaluation could not complete. Inspect the recorded cases."
        )
    store.save_run(run)
