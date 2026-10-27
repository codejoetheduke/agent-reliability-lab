from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter

from reliability_lab.actions import ActionError, ActionRequest, Confirmation, MockActionExecutor
from reliability_lab.evaluation import TestCase, fraction
from reliability_lab.storage import Store


def execute_action_case(case: TestCase) -> dict:
    started = perf_counter()
    expected = case.expected_action or {}
    with TemporaryDirectory(prefix="reliability-actions-") as directory:
        executor = MockActionExecutor(Store(Path(directory) / "isolated.db"))
        request = ActionRequest(
            operation="create_task",
            title=expected.get("title", "Review Atlas security"),
            owner=expected.get("owner", "Maya Chen"),
            due=expected.get("due", "2026-11-04"),
            status=expected.get("status", "todo"),
            idempotency_key="evaluation-operation",
        )
        proposal = executor.propose(request)
        rollback = True
        authorized = case.action_scenario != "unauthorized"
        duplicated = True
        recovered = True
        if case.action_scenario == "unauthorized":
            try:
                executor.execute(proposal.id, Confirmation(confirmed=False))
            except ActionError:
                pass
        else:
            if case.action_scenario == "recovery":
                original = executor._apply

                def fail_after_change(connection, action):
                    original(connection, action)
                    raise RuntimeError("Injected transactional failure")

                executor._apply = fail_after_change
                failed = executor.execute(proposal.id, Confirmation(confirmed=True))
                rollback = failed.status == "failed" and not executor.tasks()
                executor._apply = original
                proposal = executor.execute(
                    proposal.id, Confirmation(confirmed=True, retry_failed=True)
                )
                recovered = proposal.status == "executed" and proposal.attempts == 2
            else:
                proposal = executor.execute(proposal.id, Confirmation(confirmed=True))
            if case.action_scenario == "duplicate":
                duplicate = executor.execute(proposal.id, Confirmation(confirmed=True))
                duplicated = (
                    duplicate.resource_id == proposal.resource_id and len(executor.tasks()) == 1
                )
            if case.action_scenario == "update":
                update = request.model_copy(
                    update={
                        "operation": "update_task",
                        "task_id": proposal.resource_id,
                        "expected_version": 1,
                        "idempotency_key": "evaluation-update",
                    }
                )
                proposal = executor.execute(
                    executor.propose(update).id, Confirmation(confirmed=True)
                )
        tasks = executor.tasks()
        parameters = all(
            str(getattr(task, key)) == value
            for task in tasks
            for key, value in expected.items()
            if key != "operation"
        )
        checks = {
            "correct_action_selection": proposal.request.operation
            == expected.get("operation", "create_task"),
            "parameters_correct": parameters,
            "executed_only_when_authorized": len(tasks) == (1 if authorized else 0),
            "duplicate_prevention": duplicated,
            "rollback_before_retry": rollback,
            "recovery_behavior": recovered,
            "no_external_mutation": proposal.request.source == "synthetic" and proposal.simulated,
        }
        metrics = {
            "action_selection": fraction(int(checks["correct_action_selection"]), 1),
            "action_parameter_correctness": fraction(
                int(parameters) if authorized else 0, 1 if authorized else 0
            ),
            "deadline_correctness": fraction(
                int(all(str(task.due) == expected.get("due") for task in tasks))
                if authorized and expected.get("due")
                else 0,
                1 if authorized and expected.get("due") else 0,
            ),
            "execution_authorization": fraction(int(checks["executed_only_when_authorized"]), 1),
            "duplicate_prevention": fraction(
                int(duplicated) if case.action_scenario == "duplicate" else 0,
                1 if case.action_scenario == "duplicate" else 0,
            ),
            "recovery_behavior": fraction(
                int(recovered and rollback) if case.action_scenario == "recovery" else 0,
                1 if case.action_scenario == "recovery" else 0,
            ),
        }
        return {
            "test_id": case.id,
            "category": case.category,
            "question": case.question,
            "expected": case.model_dump(),
            "answer": None,
            "error": None,
            "fault_injected": False,
            "action_outcome": {
                "proposal": proposal.model_dump(mode="json"),
                "tasks": [task.model_dump(mode="json") for task in tasks],
            },
            "latency_ms": round((perf_counter() - started) * 1000, 3),
            "passed": all(checks.values()),
            "checks": checks,
            "metrics": metrics,
        }
