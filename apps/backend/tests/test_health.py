import asyncio

import httpx

from reliability_lab.main import app


def get(path, headers=None):
    async def request():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            return await client.get(path, headers=headers)

    return asyncio.run(request())


def test_starts_without_credentials(monkeypatch):
    monkeypatch.delenv("NOTION_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "service": "agent-reliability-lab",
        "status": "ok",
        "mode": "mock",
        "version": "0.1.0",
    }


def test_response_never_includes_environment_secrets(monkeypatch, caplog):
    sentinel = "private-test-sentinel-not-a-real-key"
    monkeypatch.setenv("NOTION_API_KEY", sentinel)
    response = get("/health")
    assert sentinel not in response.text + caplog.text


def test_unknown_route_has_safe_consistent_error():
    response = get("/missing")
    assert response.status_code == 404
    assert set(response.json()) == {"code", "message"}


def test_cors_allows_desktop_and_blocks_unrelated_websites():
    for origin in ["http://localhost:1420", "http://tauri.localhost"]:
        response = get("/health", headers={"Origin": origin})
        assert response.headers["access-control-allow-origin"] == origin
    response = get("/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in response.headers


def test_untrusted_host_rejected():
    assert get("/health", headers={"Host": "untrusted.example"}).status_code == 400
