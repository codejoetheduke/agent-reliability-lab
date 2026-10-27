from dataclasses import replace
from typing import Literal

from pydantic import Field

from reliability_lab.domain import StrictModel, preferred_provider
from reliability_lab.evaluation import METRIC_VERSION, aggregate, digest, execute_case, load_dataset
from reliability_lab.gemini import GeminiProvider
from reliability_lab.providers import PROMPT_VERSION, OpenAIProvider, get_provider
from reliability_lab.storage import Store
from reliability_lab.workspace import SyntheticWorkspace


class RunRequest(StrictModel):
    dataset_id: str = "synthetic-v1"
    top_k: int = Field(default=4, ge=1, le=10)
    label: str = Field(default="Mock baseline", min_length=1, max_length=80)
    provider: Literal["mock", "openai", "gemini"] = Field(default_factory=preferred_provider)
    model: str | None = Field(
        default=None, min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9._:-]+$"
    )
    allow_external_transmission: bool = False


async def prepare_run(request: RunRequest, store: Store) -> dict:
    dataset = load_dataset(request.dataset_id)
    adapter = get_provider(request.provider, request.model)
    if request.provider != "mock" and not request.allow_external_transmission:
        raise ValueError("External transmission consent is required.")
    fixtures = [record.model_dump() for record in await SyntheticWorkspace().records()]
    settings = adapter.settings if isinstance(adapter, (OpenAIProvider, GeminiProvider)) else None
    selected_model = adapter.model if settings else "extractive-mock-v1"
    conditions = {
        "retrieval": "lexical-v1",
        "answer_validation": "extractive-grounding-v1",
        "action_policy": "sqlite-transactional-v1",
        "source": "synthetic-fixtures",
        "provider_timeout_seconds": settings.timeout_seconds if settings else None,
        "max_output_tokens": 2000 if settings else None,
        "request_interval_seconds": getattr(settings, "request_interval_seconds", 0),
    }
    return store.create_run(
        {
            "dataset_id": dataset.id,
            "dataset_version": dataset.version,
            "dataset_hash": digest(dataset.model_dump()),
            "fixture_hash": digest(fixtures),
            "metric_version": METRIC_VERSION,
            "top_k": request.top_k,
            "label": request.label,
            "provider": request.provider,
            "model": selected_model,
            "simulated": request.provider == "mock",
            "prompt_version": getattr(adapter, "prompt_version", PROMPT_VERSION),
            "conditions_hash": digest(conditions),
            "execution_settings": conditions,
            "pricing": {
                "model": selected_model,
                "input_per_million": settings.input_price,
                "output_per_million": settings.output_price,
            }
            if settings and selected_model == settings.model
            else None,
            "dataset_snapshot": dataset.model_dump(),
            "fixture_snapshot": fixtures,
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
        from reliability_lab.domain import Record
        from reliability_lab.evaluation import Dataset

        dataset = (
            Dataset.model_validate(run["dataset_snapshot"])
            if run.get("dataset_snapshot")
            else load_dataset(run["dataset_id"])
        )
        fixtures = (
            [Record.model_validate(record) for record in run["fixture_snapshot"]]
            if run.get("fixture_snapshot")
            else None
        )
        adapter = get_provider(run["provider"], run["model"])
        if isinstance(adapter, (OpenAIProvider, GeminiProvider)) and run.get("execution_settings"):
            pricing = run.get("pricing") or {}
            adapter.settings = replace(
                adapter.settings,
                model=run["model"],
                timeout_seconds=run["execution_settings"]["provider_timeout_seconds"],
                input_price=pricing.get("input_per_million"),
                output_price=pricing.get("output_per_million"),
            )
            if isinstance(adapter, GeminiProvider):
                adapter.settings = replace(
                    adapter.settings,
                    request_interval_seconds=run["execution_settings"].get(
                        "request_interval_seconds", 7
                    ),
                )
        for case in dataset.cases:
            result = await execute_case(
                case, run["top_k"], run["provider"], run["model"], fixtures, adapter
            )
            run["results"].append(result)
            run["summary"] = aggregate(run["results"])
            store.save_run(run)
            if result["error"] in {
                "not_configured",
                "quota_exhausted",
                "rate_limited",
                "invalid_credentials",
            }:
                run.update(
                    status="failed",
                    error=(
                        "Evaluation stopped: check provider configuration, quota, or API credits."
                    ),
                )
                break
        else:
            run["status"] = "completed"
    except Exception:
        run.update(
            status="failed", error="The evaluation could not complete. Inspect the recorded cases."
        )
    store.save_run(run)
