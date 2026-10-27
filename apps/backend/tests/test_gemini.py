import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from reliability_lab.agent import Agent
from reliability_lab.config import GeminiSettings, default_provider, public_config
from reliability_lab.domain import QueryRequest
from reliability_lab.gemini import GeminiProvider
from reliability_lab.main import app
from reliability_lab.providers import ProviderError, get_provider
from reliability_lab.workspace import SyntheticWorkspace

SENTINEL = "test-google-credential-never-real"


def settings():
    return GeminiSettings(SecretStr(SENTINEL), "gemini-3.5-flash-lite", 2, 1, 2)


def response(**updates):
    data = {
        "citations": [{"record_id": "atlas-plan", "quote": "Atlas owner is Maya Chen."}],
        "abstained": False,
        "reason": "answered",
    }
    data.update(updates)
    return {
        "candidates": [
            {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(data)}]}}
        ],
        "usageMetadata": {
            "promptTokenCount": 100,
            "candidatesTokenCount": 20,
            "thoughtsTokenCount": 5,
        },
        "modelVersion": "gemini-3.5-flash-lite",
    }


def test_live_is_default_and_missing_key_never_falls_back(monkeypatch):
    monkeypatch.delenv("LAB_DEFAULT_PROVIDER")
    assert default_provider() == "gemini"
    assert QueryRequest(question="Atlas owner").provider == "gemini"
    with pytest.raises(ProviderError, match="API key"):
        get_provider("gemini")


def test_structured_wire_grounding_and_usage(caplog):
    def handler(request):
        assert request.headers["x-goog-api-key"] == SENTINEL
        assert SENTINEL not in str(request.url) + request.content.decode()
        payload = json.loads(request.content)
        assert payload["store"] is False
        assert "tools" not in payload
        assert payload["generationConfig"]["responseFormat"]["text"]["schema"]["required"]
        return httpx.Response(200, json=response())

    provider = GeminiProvider(settings(), transport=httpx.MockTransport(handler))
    answer = asyncio.run(
        Agent(SyntheticWorkspace(), provider).query(
            QueryRequest(question="Who owns Atlas?", provider="gemini")
        )
    )
    assert answer.answer == "Atlas owner is Maya Chen."
    assert answer.provider == "gemini" and not answer.simulated
    assert answer.input_tokens == 100 and answer.output_tokens == 25
    assert answer.estimated_cost_usd == pytest.approx(0.00015)
    assert SENTINEL not in answer.model_dump_json() + caplog.text


@pytest.mark.parametrize(
    "kind,expected",
    [
        ("timeout", "timeout"),
        ("rate", "rate_limited"),
        ("key", "invalid_credentials"),
        ("malformed", "invalid_output"),
        ("unsupported", "invalid_output"),
        ("refused", "refused"),
    ],
)
def test_gemini_errors_never_leak_credentials(kind, expected):
    def handler(_):
        if kind == "timeout":
            raise httpx.ReadTimeout(SENTINEL)
        if kind == "rate":
            return httpx.Response(429, json={"error": SENTINEL})
        if kind == "key":
            return httpx.Response(
                400,
                json={"error": {"details": [{"reason": "API_KEY_INVALID"}], "message": SENTINEL}},
            )
        if kind == "refused":
            return httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})
        if kind == "malformed":
            return httpx.Response(200, json={})
        return httpx.Response(
            200, json=response(citations=[{"record_id": "missing", "quote": "Invented"}])
        )

    provider = GeminiProvider(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as error:
        asyncio.run(
            Agent(SyntheticWorkspace(), provider).query(QueryRequest(question="Atlas owner"))
        )
    assert error.value.code == expected
    assert SENTINEL not in str(error.value)


def test_gemini_public_config_and_consent(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", SENTINEL)
    assert public_config()["gemini_configured"]
    assert SENTINEL not in json.dumps(public_config())

    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
            headers={"X-Lab-Token": "unit-test-session"},
        ) as client:
            result = await client.post(
                "/agent/query", json={"provider": "gemini", "question": "Who owns Atlas?"}
            )
            assert result.status_code == 400

    asyncio.run(check())


def test_override_does_not_reuse_other_model_prices():
    provider = GeminiProvider(
        settings(),
        "different-model",
        httpx.MockTransport(lambda _: httpx.Response(200, json=response())),
    )
    assert asyncio.run(provider.generate("Atlas owner", [])).estimated_cost_usd is None


def test_notion_retrieval_accepts_natural_phrasing_without_changing_fixture_policy():
    from reliability_lab.domain import Record
    from reliability_lab.notion import NotionWorkspace
    from reliability_lab.workspace import retrieve

    record = Record(
        id="fictional",
        title="Test workspace",
        kind="note",
        body="A fictional workspace for testing evidence retrieval.",
    )
    question = "What is the purpose of this test workspace?"
    assert retrieve(question, [record], 4) == []
    assert retrieve(question, [record], 4, strict_anchors=False) == [record]
    assert NotionWorkspace.strict_anchors is False


def test_cancelled_live_evaluation_is_recorded_without_continuing_calls(tmp_path, monkeypatch):
    from reliability_lab.evaluation_service import RunRequest, perform_run, prepare_run
    from reliability_lab.storage import Store

    async def check():
        entered = asyncio.Event()
        calls = []

        async def hanging_request(request):
            calls.append(request.url.path)
            entered.set()
            await asyncio.Event().wait()
            return httpx.Response(200, json=response())

        adapter = GeminiProvider(settings(), transport=httpx.MockTransport(hanging_request))
        monkeypatch.setattr("reliability_lab.evaluation_service.get_provider", lambda *_: adapter)
        store = Store(tmp_path / "interrupted.db")
        run = await prepare_run(
            RunRequest(provider="gemini", allow_external_transmission=True), store
        )
        task = asyncio.create_task(perform_run(run["id"], store))
        await asyncio.wait_for(entered.wait(), timeout=2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert len(calls) == 1
        assert store.run(run["id"])["status"] == "interrupted"
        assert store.run(run["id"])["results"] == []

    asyncio.run(check())


def test_parent_shutdown_between_cases_stops_the_next_provider_call(tmp_path, monkeypatch):
    from reliability_lab.evaluation_service import (
        RunRequest,
        perform_run,
        prepare_run,
        shutdown_requested,
    )
    from reliability_lab.providers import MockProvider
    from reliability_lab.storage import Store

    calls = []

    class StopAfterResponse(MockProvider):
        async def generate(self, question, evidence):
            calls.append(question)
            answer = await super().generate(question, evidence)
            shutdown_requested.set()
            return answer

    async def check():
        store = Store(tmp_path / "parent-close.db")
        monkeypatch.setattr(
            "reliability_lab.evaluation_service.get_provider", lambda *_: StopAfterResponse()
        )
        run = await prepare_run(RunRequest(provider="mock"), store)
        await perform_run(run["id"], store)
        assert len(calls) == 1
        assert store.run(run["id"])["status"] == "interrupted"
        assert len(store.run(run["id"])["results"]) == 1

    try:
        asyncio.run(check())
    finally:
        shutdown_requested.clear()
