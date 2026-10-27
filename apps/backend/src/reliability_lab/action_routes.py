from fastapi import APIRouter

from reliability_lab.actions import (
    ActionRequest,
    Confirmation,
    MockActionExecutor,
    MockTask,
    Proposal,
)
from reliability_lab.routes import StoreDependency

router = APIRouter(prefix="/actions")


@router.get("/tasks", response_model=list[MockTask])
async def tasks(store: StoreDependency):
    return MockActionExecutor(store).tasks()


@router.get("/proposals", response_model=list[Proposal])
async def proposals(store: StoreDependency):
    return MockActionExecutor(store).proposals()


@router.post("/proposals", response_model=Proposal)
async def propose(request: ActionRequest, store: StoreDependency):
    return MockActionExecutor(store).propose(request)


@router.post("/proposals/{proposal_id}/execute", response_model=Proposal)
async def execute(proposal_id: str, confirmation: Confirmation, store: StoreDependency):
    return MockActionExecutor(store).execute(proposal_id, confirmation)


@router.post("/proposals/{proposal_id}/cancel", response_model=Proposal)
async def cancel(proposal_id: str, store: StoreDependency):
    return MockActionExecutor(store).cancel(proposal_id)


@router.delete("")
async def reset(confirmation: Confirmation, store: StoreDependency):
    MockActionExecutor(store).reset(confirmation)
    return {"deleted": True}
