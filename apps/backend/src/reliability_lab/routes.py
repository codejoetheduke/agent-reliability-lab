from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from reliability_lab.evaluation import load_dataset
from reliability_lab.evaluation_models import (
    CaseResult,
    DatasetInfo,
    OverviewInfo,
    RunDetail,
    RunSummary,
)
from reliability_lab.evaluation_service import RunRequest, perform_run, prepare_run
from reliability_lab.storage import Store, get_store

router = APIRouter()
StoreDependency = Annotated[Store, Depends(get_store)]


@router.get("/datasets", response_model=list[DatasetInfo])
async def datasets():
    dataset = load_dataset()
    return [
        {
            "id": dataset.id,
            "version": dataset.version,
            "description": dataset.description,
            "test_count": len(dataset.cases),
        }
    ]


@router.post("/runs", status_code=202, response_model=RunSummary)
async def start_run(request: RunRequest, background: BackgroundTasks, store: StoreDependency):
    try:
        run = await prepare_run(request, store)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    background.add_task(perform_run, run["id"], store)
    return {key: value for key, value in run.items() if key != "results"}


@router.get("/runs", response_model=list[RunSummary])
async def list_runs(
    store: StoreDependency,
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return store.list_runs(limit, offset)


@router.get("/runs/{run_id}", response_model=RunDetail)
async def get_run(run_id: str, store: StoreDependency):
    run = store.run(run_id)
    if run is None:
        raise HTTPException(404, "Run not found.")
    return run


@router.get("/runs/{run_id}/tests/{test_id}", response_model=CaseResult)
async def get_result(run_id: str, test_id: str, store: StoreDependency):
    run = await get_run(run_id, store)
    result = next((item for item in run["results"] if item["test_id"] == test_id), None)
    if result is None:
        raise HTTPException(404, "Test result not found.")
    return result


@router.delete("/history")
async def delete_history(store: StoreDependency):
    try:
        store.delete_history()
    except ValueError as exc:
        raise HTTPException(409, "Active runs prevent history deletion.") from exc
    return {"deleted": True}


@router.get("/overview", response_model=OverviewInfo)
async def overview(store: StoreDependency):
    return store.overview()
