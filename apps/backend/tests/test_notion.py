import asyncio
import json

import httpx
import pytest

from reliability_lab.notion import NOTION_VERSION, NotionWorkspace, SourceError

ROOT = "11111111-1111-4111-8111-111111111111"
CHILD = "22222222-2222-4222-8222-222222222222"
BLOCK = "33333333-3333-4333-8333-333333333333"
OUTSIDE = "44444444-4444-4444-8444-444444444444"
DATABASE = "55555555-5555-4555-8555-555555555555"
SOURCE = "66666666-6666-4666-8666-666666666666"


def text(value):
    return [{"plain_text": value}]


def page(id=ROOT, parent=None):
    return {
        "object": "page",
        "id": id,
        "url": "https://www.notion.so/" + id.replace("-", ""),
        "parent": parent or {"type": "workspace", "workspace": True},
        "properties": {"Name": {"type": "title", "title": text("Fictional Atlas plan")}},
    }


def listing(results, more=False, cursor=None):
    return {"results": results, "has_more": more, "next_cursor": cursor}


def test_pagination_descendants_and_no_arbitrary_links(caplog):
    requested = []

    def handle(request):
        requested.append(str(request.url))
        assert request.headers["Notion-Version"] == NOTION_VERSION
        path = request.url.path
        if path == f"/v1/pages/{ROOT}":
            return httpx.Response(200, json=page())
        if path == f"/v1/pages/{CHILD}":
            return httpx.Response(200, json=page(CHILD, {"type": "page_id", "page_id": ROOT}))
        if path == f"/v1/blocks/{ROOT}/children":
            if request.url.params.get("start_cursor") == "second":
                return httpx.Response(
                    200,
                    json=listing(
                        [
                            {
                                "id": CHILD,
                                "type": "child_page",
                                "child_page": {"title": "Child"},
                                "has_children": False,
                            }
                        ]
                    ),
                )
            return httpx.Response(
                200,
                json=listing(
                    [
                        {
                            "id": BLOCK,
                            "type": "paragraph",
                            "paragraph": {"rich_text": text("Atlas owner is Maya Chen.")},
                            "has_children": False,
                        },
                        {
                            "id": OUTSIDE,
                            "type": "link_to_page",
                            "link_to_page": {"page_id": OUTSIDE},
                            "has_children": False,
                        },
                    ],
                    True,
                    "second",
                ),
            )
        if path == f"/v1/blocks/{CHILD}/children":
            return httpx.Response(200, json=listing([]))
        raise AssertionError("Out-of-scope request")

    source = NotionWorkspace("private-notion-test-token", (ROOT,), httpx.MockTransport(handle), 0)
    records = asyncio.run(source.records())
    assert len(records) == 2
    assert "Atlas owner is Maya Chen." in records[0].body
    assert records[0].id == "notion:" + ROOT and records[0].url
    assert not any(f"/pages/{OUTSIDE}" in url for url in requested)
    assert "private-notion-test-token" not in caplog.text


def test_discovered_page_with_unexpected_parent_is_rejected():
    def handle(request):
        if request.url.path == f"/v1/pages/{ROOT}":
            return httpx.Response(200, json=page())
        if request.url.path == f"/v1/blocks/{ROOT}/children":
            return httpx.Response(
                200,
                json=listing(
                    [{"id": CHILD, "type": "child_page", "child_page": {}, "has_children": False}]
                ),
            )
        return httpx.Response(200, json=page(CHILD, {"type": "page_id", "page_id": OUTSIDE}))

    with pytest.raises(SourceError) as failure:
        asyncio.run(NotionWorkspace("test", (ROOT,), httpx.MockTransport(handle), 0).records())
    assert failure.value.code == "scope_violation"


def test_contained_database_uses_read_only_data_source_query():
    methods = []

    def handle(request):
        methods.append((request.method, request.url.path))
        path = request.url.path
        if path == f"/v1/pages/{ROOT}":
            return httpx.Response(200, json=page())
        if path == f"/v1/blocks/{ROOT}/children":
            return httpx.Response(
                200,
                json=listing(
                    [
                        {
                            "id": DATABASE,
                            "type": "child_database",
                            "child_database": {},
                            "has_children": False,
                        }
                    ]
                ),
            )
        if path == f"/v1/databases/{DATABASE}":
            return httpx.Response(
                200,
                json={
                    "id": DATABASE,
                    "parent": {"type": "page_id", "page_id": ROOT},
                    "data_sources": [{"id": SOURCE}],
                },
            )
        if path == f"/v1/data_sources/{SOURCE}/query":
            assert request.method == "POST" and json.loads(request.content)["page_size"] == 100
            return httpx.Response(
                200,
                json=listing([page(CHILD, {"type": "data_source_id", "data_source_id": SOURCE})]),
            )
        if path == f"/v1/blocks/{CHILD}/children":
            return httpx.Response(200, json=listing([]))
        raise AssertionError("Unexpected request")

    records = asyncio.run(
        NotionWorkspace("test", (ROOT,), httpx.MockTransport(handle), 0).records()
    )
    assert len(records) == 2
    assert all(method == "GET" or path.endswith("/query") for method, path in methods)


@pytest.mark.parametrize(
    "status,code", [(403, "permission_denied"), (404, "permission_denied"), (500, "unavailable")]
)
def test_api_errors_are_safe(status, code):
    source = NotionWorkspace(
        "never-return-this",
        (ROOT,),
        httpx.MockTransport(
            lambda _: httpx.Response(status, json={"message": "never-return-this"})
        ),
        0,
    )
    with pytest.raises(SourceError) as failure:
        asyncio.run(source.records())
    assert failure.value.code == code and "never-return-this" not in str(failure.value)


def test_rate_limit_long_retry_does_not_spin():
    source = NotionWorkspace(
        "test",
        (ROOT,),
        httpx.MockTransport(lambda _: httpx.Response(429, headers={"Retry-After": "60"})),
        0,
    )
    with pytest.raises(SourceError) as failure:
        asyncio.run(source.records())
    assert failure.value.code == "rate_limited"


def test_short_rate_limit_is_respected_and_snapshot_cache_is_copied(monkeypatch):
    waits = []
    calls = []

    async def fake_sleep(delay):
        waits.append(delay)

    monkeypatch.setattr("reliability_lab.notion.asyncio.sleep", fake_sleep)

    def handle(request):
        calls.append(request.url.path)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "2"})
        if "/pages/" in request.url.path:
            return httpx.Response(200, json=page())
        return httpx.Response(200, json=listing([]))

    async def check():
        source = NotionWorkspace("test", (ROOT,), httpx.MockTransport(handle), 0)
        first = await source.records()
        first[0].body = "Client-side change"
        second = await source.records()
        assert second[0].body != "Client-side change"
        assert len(calls) == 3 and waits == [2.0]
        await source.clear_cache()
        assert not source._snapshot

    asyncio.run(check())


def test_missing_scope_never_makes_request_and_malformed_pagination_rejected():
    with pytest.raises(SourceError):
        NotionWorkspace("test", ())

    def handle(request):
        if "/pages/" in request.url.path:
            return httpx.Response(200, json=page())
        return httpx.Response(200, json=listing([], True, None))

    with pytest.raises(SourceError) as failure:
        asyncio.run(NotionWorkspace("test", (ROOT,), httpx.MockTransport(handle), 0).records())
    assert failure.value.code == "invalid_response"
