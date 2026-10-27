import asyncio

import httpx

from reliability_lab.main import app
from reliability_lab.notion import NOTION_VERSION
from reliability_lab.workspace import SyntheticWorkspace


def test_notion_inspection_api_and_benchmark_separation(monkeypatch):
    class ScopedTestSource:
        roots = ("synthetic-test-root",)
        cleared = False

        async def records(self):
            return await SyntheticWorkspace().records()

        async def clear_cache(self):
            self.cleared = True

    source = ScopedTestSource()
    monkeypatch.setattr("reliability_lab.main.get_notion_source", lambda: source)

    async def check():
        async with httpx.AsyncClient(
            headers={"X-Lab-Token": "unit-test-session"},
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            status = (await client.post("/notion/check")).json()
            assert status["connected"] and status["read_only"]
            assert status["api_version"] == NOTION_VERSION
            assert len((await client.get("/notion/records")).json()) == 9
            response = await client.post(
                "/agent/query", json={"question": "Who owns Atlas?", "source": "notion"}
            )
            assert response.status_code == 200
            assert (await client.post("/runs", json={"source": "notion"})).status_code == 422
            assert (await client.post("/notion/clear-cache")).json()["cleared"]
            assert source.cleared

    asyncio.run(check())
