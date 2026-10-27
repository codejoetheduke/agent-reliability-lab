"""Confirmed mock mutations. No external API or model can execute these operations."""

from datetime import date
from typing import Literal
from uuid import uuid4

from pydantic import Field, StrictBool, model_validator

from reliability_lab.domain import StrictModel
from reliability_lab.evaluation import digest
from reliability_lab.storage import Store, now


class ActionError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.status = status
        super().__init__(message)


class ActionRequest(StrictModel):
    operation: Literal["create_task", "update_task"]
    source: Literal["synthetic", "notion"] = "synthetic"
    title: str = Field(min_length=1, max_length=200)
    owner: str = Field(min_length=1, max_length=120)
    due: date | None = None
    status: Literal["todo", "in_progress", "done"] = "todo"
    task_id: str | None = Field(default=None, pattern=r"^mock-[a-f0-9]{32}$")
    expected_version: int | None = Field(default=None, ge=1)
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r"^[a-zA-Z0-9._-]+$")

    @model_validator(mode="after")
    def operation_parameters(self):
        if self.operation == "update_task" and (not self.task_id or self.expected_version is None):
            raise ValueError("Task updates require a task identifier and expected version.")
        if self.operation == "create_task" and (self.task_id or self.expected_version is not None):
            raise ValueError("Task creation does not accept an existing task identifier.")
        return self


class Confirmation(StrictModel):
    confirmed: StrictBool = False
    retry_failed: StrictBool = False


class MockTask(StrictModel):
    id: str
    title: str
    owner: str
    due: date | None
    status: Literal["todo", "in_progress", "done"]
    version: int
    created_at: str


class Proposal(StrictModel):
    id: str
    created_at: str
    request: ActionRequest
    fingerprint: str
    status: Literal["proposed", "executed", "failed", "cancelled"] = "proposed"
    resource_id: str | None = None
    error: str | None = None
    attempts: int = 0
    simulated: bool = True


class MockActionExecutor:
    def __init__(self, store: Store):
        self.store = store

    def tasks(self) -> list[MockTask]:
        with self.store.connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM mock_tasks ORDER BY id LIMIT 100"
            ).fetchall()
        return [MockTask.model_validate_json(row["payload"]) for row in rows]

    def proposals(self) -> list[Proposal]:
        with self.store.connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM proposals ORDER BY rowid DESC LIMIT 100"
            ).fetchall()
        return [Proposal.model_validate_json(row["payload"]) for row in rows]

    def propose(self, request: ActionRequest) -> Proposal:
        if request.source != "synthetic":
            raise ActionError(
                "Notion access is read-only. No real workspace mutation is supported.", 403
            )
        fingerprint = digest(request.model_dump(mode="json", exclude={"idempotency_key"}))
        with self.store.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT payload FROM proposals WHERE idempotency_key=?", (request.idempotency_key,)
            ).fetchone()
            if row:
                proposal = Proposal.model_validate_json(row["payload"])
                if proposal.fingerprint != fingerprint:
                    raise ActionError("This idempotency key belongs to a different operation.")
                return proposal
            if request.operation == "update_task":
                task = self._task(connection, request.task_id)
                if task.version != request.expected_version:
                    raise ActionError("The task version changed. Review it and propose again.")
            proposal = Proposal(
                id=uuid4().hex, created_at=now(), request=request, fingerprint=fingerprint
            )
            connection.execute(
                "INSERT INTO proposals VALUES (?,?,?)",
                (proposal.id, request.idempotency_key, proposal.model_dump_json()),
            )
        return proposal

    def _task(self, connection, task_id: str | None) -> MockTask:
        row = connection.execute("SELECT payload FROM mock_tasks WHERE id=?", (task_id,)).fetchone()
        if row is None:
            raise ActionError("The selected mock task does not exist.", 404)
        return MockTask.model_validate_json(row["payload"])

    def _apply(self, connection, request: ActionRequest) -> str:
        if request.operation == "create_task":
            task = MockTask(
                id="mock-" + uuid4().hex,
                title=request.title,
                owner=request.owner,
                due=request.due,
                status=request.status,
                version=1,
                created_at=now(),
            )
            connection.execute(
                "INSERT INTO mock_tasks VALUES (?,?)", (task.id, task.model_dump_json())
            )
        else:
            task = self._task(connection, request.task_id)
            if task.version != request.expected_version:
                raise ActionError("The task version changed. Create a new proposal.")
            task = task.model_copy(
                update={
                    "title": request.title,
                    "owner": request.owner,
                    "due": request.due,
                    "status": request.status,
                    "version": task.version + 1,
                }
            )
            connection.execute(
                "UPDATE mock_tasks SET payload=? WHERE id=?", (task.model_dump_json(), task.id)
            )
        return task.id

    def execute(self, proposal_id: str, confirmation: Confirmation) -> Proposal:
        if not confirmation.confirmed:
            raise ActionError("Explicit confirmation is required before execution.", 403)
        with self.store.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT payload FROM proposals WHERE id=?", (proposal_id,)
            ).fetchone()
            if row is None:
                raise ActionError("Proposal not found.", 404)
            proposal = Proposal.model_validate_json(row["payload"])
            if proposal.request.source != "synthetic":
                raise ActionError("Notion access is read-only.", 403)
            if proposal.status == "executed":
                return proposal
            if proposal.status == "cancelled":
                raise ActionError("This proposal was cancelled.")
            if proposal.status == "failed" and not confirmation.retry_failed:
                raise ActionError("A failed operation requires an explicit retry confirmation.")
            proposal.attempts += 1
            connection.execute("SAVEPOINT mock_operation")
            try:
                resource = self._apply(connection, proposal.request)
                proposal.status = "executed"
                proposal.resource_id = resource
                proposal.error = None
                connection.execute("RELEASE mock_operation")
            except Exception as failure:
                connection.execute("ROLLBACK TO mock_operation")
                connection.execute("RELEASE mock_operation")
                proposal.status = "failed"
                proposal.error = (
                    str(failure)
                    if isinstance(failure, ActionError)
                    else "The mock operation failed. Nothing was committed. Review before retrying."
                )
            connection.execute(
                "UPDATE proposals SET payload=? WHERE id=?",
                (proposal.model_dump_json(), proposal.id),
            )
        return proposal

    def cancel(self, proposal_id: str) -> Proposal:
        with self.store.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT payload FROM proposals WHERE id=?", (proposal_id,)
            ).fetchone()
            if row is None:
                raise ActionError("Proposal not found.", 404)
            proposal = Proposal.model_validate_json(row["payload"])
            if proposal.status == "executed":
                raise ActionError("An executed action cannot be cancelled.")
            proposal.status = "cancelled"
            connection.execute(
                "UPDATE proposals SET payload=? WHERE id=?",
                (proposal.model_dump_json(), proposal.id),
            )
        return proposal

    def reset(self, confirmation: Confirmation):
        if not confirmation.confirmed:
            raise ActionError("Explicit confirmation is required to reset mock actions.", 403)
        with self.store.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM proposals")
            connection.execute("DELETE FROM mock_tasks")
