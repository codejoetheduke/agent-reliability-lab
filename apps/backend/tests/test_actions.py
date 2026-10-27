import asyncio
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from pydantic import ValidationError

from reliability_lab.actions import ActionError, ActionRequest, Confirmation, MockActionExecutor
from reliability_lab.main import app
from reliability_lab.storage import Store


def request(**changes):
    return ActionRequest(
        operation="create_task",
        title="Review Atlas security",
        owner="Maya Chen",
        due="2026-11-04",
        idempotency_key="request-create-1",
        **changes,
    )


def test_unconfirmed_and_cancelled_proposals_never_execute(tmp_path):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    proposal = executor.propose(request())
    assert not executor.tasks()
    with pytest.raises(ActionError):
        executor.execute(proposal.id, Confirmation())
    executor.cancel(proposal.id)
    with pytest.raises(ActionError):
        executor.execute(proposal.id, Confirmation(confirmed=True))
    assert not executor.tasks()


def test_duplicate_requests_and_concurrent_execution_create_one_task(tmp_path):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    proposal = executor.propose(request())
    assert executor.propose(request()).id == proposal.id
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda _: executor.execute(proposal.id, Confirmation(confirmed=True)), range(2)
            )
        )
    assert results[0].resource_id == results[1].resource_id
    assert len(executor.tasks()) == 1
    task = executor.tasks()[0]
    assert task.title == "Review Atlas security" and task.owner == "Maya Chen"
    assert task.due.isoformat() == "2026-11-04"
    assert results[0].attempts == results[1].attempts == 1


def test_idempotency_key_reuse_with_different_parameters_rejected(tmp_path):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    original = request()
    executor.propose(original)
    with pytest.raises(ActionError):
        executor.propose(original.model_copy(update={"title": "Different"}))


def test_update_validates_version_and_preserves_requested_parameters(tmp_path):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    first = executor.propose(request())
    resource = executor.execute(first.id, Confirmation(confirmed=True)).resource_id
    update = ActionRequest(
        operation="update_task",
        task_id=resource,
        expected_version=1,
        title="Security review complete",
        owner="Sam Rivera",
        due="2026-11-06",
        status="done",
        idempotency_key="request-update-1",
    )
    proposal = executor.propose(update)
    competing = executor.propose(update.model_copy(update={"idempotency_key": "request-update-2"}))
    assert executor.execute(proposal.id, Confirmation(confirmed=True)).status == "executed"
    assert executor.execute(competing.id, Confirmation(confirmed=True)).status == "failed"
    task = executor.tasks()[0]
    assert task.version == 2 and task.owner == "Sam Rivera" and task.status == "done"
    assert task.due.isoformat() == "2026-11-06"


def test_failed_operation_rolls_back_and_explicit_retry_recovers(tmp_path, monkeypatch):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    proposal = executor.propose(request())
    original = executor._apply

    def fail_after_insert(connection, action):
        original(connection, action)
        raise RuntimeError("private error details")

    monkeypatch.setattr(executor, "_apply", fail_after_insert)
    failed = executor.execute(proposal.id, Confirmation(confirmed=True))
    assert failed.status == "failed" and not executor.tasks()
    assert "private error details" not in failed.model_dump_json()
    with pytest.raises(ActionError):
        executor.execute(proposal.id, Confirmation(confirmed=True))
    monkeypatch.setattr(executor, "_apply", original)
    recovered = executor.execute(proposal.id, Confirmation(confirmed=True, retry_failed=True))
    assert recovered.status == "executed" and recovered.attempts == 2
    assert len(executor.tasks()) == 1


def test_notion_mutations_rejected_and_confirmation_is_strict(tmp_path):
    executor = MockActionExecutor(Store(tmp_path / "state.db"))
    with pytest.raises(ActionError):
        executor.propose(request(source="notion"))
    with pytest.raises(ValidationError):
        Confirmation(confirmed="true")
    with pytest.raises(ValidationError):
        ActionRequest(
            operation="update_task", title="Title", owner="Owner", idempotency_key="request-missing"
        )
    assert not executor.tasks()


def test_authenticated_api_lifecycle_and_reset():
    async def check():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            proposal = (
                await client.post("/actions/proposals", json=request().model_dump(mode="json"))
            ).json()
            assert (
                await client.post(
                    f"/actions/proposals/{proposal['id']}/execute", json={"confirmed": False}
                )
            ).status_code == 403
            assert (await client.get("/actions/tasks")).json() == []
            result = (
                await client.post(
                    f"/actions/proposals/{proposal['id']}/execute", json={"confirmed": True}
                )
            ).json()
            assert result["status"] == "executed" and result["simulated"]
            assert len((await client.get("/actions/tasks")).json()) == 1
            assert (
                await client.request("DELETE", "/actions", json={"confirmed": False})
            ).status_code == 403
            assert (
                await client.request("DELETE", "/actions", json={"confirmed": True})
            ).status_code == 200
            assert (await client.get("/actions/tasks")).json() == []

    asyncio.run(check())


def test_local_session_required_except_public_health():
    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            assert (await client.get("/health")).status_code == 200
            for path in ["/config", "/runs", "/actions/tasks"]:
                assert (await client.get(path)).status_code == 401
            assert (
                await client.post("/agent/query", json={"question": "Who owns Atlas?"})
            ).status_code == 401
            assert (
                await client.get("/config", headers={"X-Lab-Token": "wrong"})
            ).status_code == 401

    asyncio.run(check())
