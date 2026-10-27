import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from reliability_lab.agent import Agent
from reliability_lab.config import Settings, get_settings, public_config
from reliability_lab.domain import QueryRequest
from reliability_lab.main import app
from reliability_lab.providers import OpenAIProvider, ProviderError
from reliability_lab.workspace import SyntheticWorkspace

SENTINEL = "unit-test-credential-never-real"


def settings():
    return Settings(SecretStr(SENTINEL), "gpt-4.1-mini", 1, 2, 4)


def test_private_credential_file_never_enters_public_configuration(tmp_path, monkeypatch):
    file = tmp_path / "private.json"
    file.write_text(json.dumps({"OPENAI_API_KEY": SENTINEL}))
    monkeypatch.setenv("LAB_CREDENTIALS_FILE", str(file))
    monkeypatch.delenv("OPENAI_API_KEY")
    assert get_settings().openai_key.get_secret_value() == SENTINEL
    assert public_config()["openai_configured"]
    assert SENTINEL not in json.dumps(public_config())


def response(data=None, usage=None):
    data = data or {
        "answer": "Atlas owner is Maya Chen.",
        "claims": [
            {
                "text": "Atlas owner is Maya Chen.",
                "citations": [{"record_id": "atlas-plan", "quote": "Atlas owner is Maya Chen."}],
            }
        ],
        "abstained": False,
        "reason": "answered",
    }
    return {
        "status": "completed",
        "model": "test-model",
        "output": [
            {"type": "message", "content": [{"type": "output_text", "text": json.dumps(data)}]}
        ],
        "usage": usage or {"input_tokens": 100, "output_tokens": 20},
    }


def test_openai_request_schema_usage_cost_and_grounding(caplog):
    def handler(request):
        payload = json.loads(request.content)
        assert payload["store"] is False
        assert payload["text"]["format"]["strict"] is True
        assert payload["text"]["format"]["schema"]["additionalProperties"] is False
        assert request.headers["authorization"] == f"Bearer {SENTINEL}"
        assert SENTINEL not in request.content.decode()
        return httpx.Response(200, json=response())

    provider = OpenAIProvider(settings(), transport=httpx.MockTransport(handler))
    answer = asyncio.run(
        Agent(SyntheticWorkspace(), provider).query(QueryRequest(question="Who owns Atlas?"))
    )
    assert not answer.simulated
    assert answer.model == "test-model"
    assert answer.input_tokens == 100 and answer.output_tokens == 20
    assert answer.estimated_cost_usd == pytest.approx(0.00028)
    assert SENTINEL not in answer.model_dump_json() + caplog.text


@pytest.mark.parametrize(
    "kind,code", [("http", "provider_error"), ("timeout", "timeout"), ("invalid", "invalid_output")]
)
def test_provider_failures_are_safe(kind, code):
    def handler(_request):
        if kind == "timeout":
            raise httpx.ReadTimeout(SENTINEL)
        if kind == "http":
            return httpx.Response(503, json={"error": SENTINEL})
        return httpx.Response(200, json={"status": "completed", "output": []})

    provider = OpenAIProvider(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as failure:
        asyncio.run(provider.generate("Who owns Atlas?", []))
    assert failure.value.code == code
    assert SENTINEL not in str(failure.value)


def test_unknown_citations_are_rejected():
    invalid = {
        "answer": "Invented",
        "claims": [{"text": "Invented", "citations": [{"record_id": "fake", "quote": "Invented"}]}],
        "abstained": False,
        "reason": "answered",
    }
    provider = OpenAIProvider(
        settings(),
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response(invalid))),
    )
    with pytest.raises(ProviderError, match="evidence validation"):
        asyncio.run(
            Agent(SyntheticWorkspace(), provider).query(QueryRequest(question="Who owns Atlas?"))
        )


def test_quota_errors_are_distinguished_without_returning_provider_body():
    transport = httpx.MockTransport(
        lambda _: httpx.Response(
            429, json={"error": {"code": "credit_balance_exhausted", "message": SENTINEL}}
        )
    )
    with pytest.raises(ProviderError) as failure:
        asyncio.run(OpenAIProvider(settings(), transport=transport).generate("Question", []))
    assert failure.value.code == "quota_exhausted"
    assert SENTINEL not in str(failure.value)


def test_action_text_never_reaches_hosted_provider():
    def forbidden(_request):
        raise AssertionError("An action request must not invoke the model.")

    provider = OpenAIProvider(settings(), transport=httpx.MockTransport(forbidden))
    answer = asyncio.run(
        Agent(SyntheticWorkspace(), provider).query(QueryRequest(question="Create an Atlas task"))
    )
    assert answer.reason == "action_requires_confirmation"


def test_config_redacts_secrets_and_hosted_queries_require_consent(monkeypatch, caplog):
    monkeypatch.setenv("OPENAI_API_KEY", SENTINEL)

    async def check():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/config")
            assert response.json()["openai_configured"]
            assert SENTINEL not in response.text + caplog.text
            assert (
                await client.post(
                    "/agent/query", json={"question": "Who owns Atlas?", "provider": "openai"}
                )
            ).status_code == 400

    asyncio.run(check())


def test_unexpected_exceptions_do_not_leak_into_responses_or_logs(monkeypatch, caplog):
    def fail(*_args):
        raise RuntimeError(SENTINEL)

    monkeypatch.setattr("reliability_lab.main.get_provider", fail)

    async def check():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post("/agent/query", json={"question": "Who owns Atlas?"})
            assert response.status_code == 500
            assert SENTINEL not in response.text + caplog.text

    asyncio.run(check())
