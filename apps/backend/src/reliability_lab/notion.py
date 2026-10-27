"""Bounded read-only Notion adapter. Only discovered descendants of selected roots are read."""

import asyncio
import hashlib
from time import monotonic
from urllib.parse import urlparse
from uuid import UUID

import httpx

from reliability_lab.config import setting
from reliability_lab.domain import Record

NOTION_VERSION = "2026-03-11"


class SourceError(Exception):
    MESSAGES = {
        "not_configured": (
            "Configure a Notion credential and selected root page IDs in private backend settings."
        ),
        "permission_denied": (
            "The selected Notion page is unavailable. Share it with the "
            "internal connection and grant read content access."
        ),
        "rate_limited": "Notion requested a longer retry delay. Wait before trying again.",
        "timeout": "The Notion read request timed out. No partial result was accepted.",
        "unavailable": "Notion could not complete the read request.",
        "invalid_response": "Notion returned an unsupported or malformed response.",
        "scope_violation": "A discovered resource is outside the selected Notion page hierarchy.",
        "scope_limit": (
            "The selected Notion hierarchy exceeds this development adapter’s limits. "
            "Select a smaller test scope."
        ),
    }

    def __init__(self, code: str):
        self.code = code
        super().__init__(self.MESSAGES[code])


def identifier(value: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise SourceError("invalid_response") from exc


def root_ids() -> tuple[str, ...]:
    value = setting("NOTION_ROOT_PAGE_IDS")
    return tuple(identifier(item.strip()) for item in value.split(",") if item.strip())


def rich_text(values) -> str:
    if not isinstance(values, list):
        return ""
    return "".join(
        str(item.get("plain_text", item.get("text", {}).get("content", "")))
        for item in values
        if isinstance(item, dict)
    )


def property_lines(properties: dict) -> list[str]:
    lines = []
    for name, prop in properties.items():
        kind = prop.get("type")
        value = prop.get(kind)
        if kind in {"title", "rich_text"}:
            text = rich_text(value)
        elif kind in {"status", "select"}:
            text = (value or {}).get("name", "")
        elif kind == "multi_select":
            text = ", ".join(item.get("name", "") for item in value or [])
        elif kind == "people":
            text = ", ".join(item.get("name", "") for item in value or [])
        elif kind == "date":
            text = " / ".join(
                str(part) for part in [(value or {}).get("start"), (value or {}).get("end")] if part
            )
        elif kind in {"number", "checkbox", "url", "email", "phone_number"}:
            text = str(value) if value is not None else ""
        else:
            continue
        if text:
            lines.append(f"{name}: {text}")
    return lines


def source_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    host = parsed.hostname or ""
    allowed = host in {
        "notion.so",
        "www.notion.so",
        "notion.com",
        "www.notion.com",
        "app.notion.com",
    } or host.endswith(".notion.site")
    return (
        value
        if parsed.scheme == "https" and allowed and not parsed.username and not parsed.password
        else None
    )


class NotionWorkspace:
    def __init__(
        self,
        token: str,
        roots: tuple[str, ...],
        transport: httpx.AsyncBaseTransport | None = None,
        interval: float = 0.36,
    ):
        self._token = token
        self.roots = tuple(identifier(root) for root in roots)
        if not token or not self.roots:
            raise SourceError("not_configured")
        self.transport = transport
        self.interval = interval
        self._last_request = 0.0
        self._snapshot: list[Record] = []
        self._expires = 0.0
        self._lock = asyncio.Lock()

    async def _request(
        self, client: httpx.AsyncClient, method: str, path: str, params: dict | None = None
    ) -> dict:
        if method not in {"GET", "POST"} or (method == "POST" and not path.endswith("/query")):
            raise SourceError("scope_violation")
        for attempt in range(3):
            wait = self.interval - (monotonic() - self._last_request)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request = monotonic()
            try:
                response = await client.request(
                    method,
                    "https://api.notion.com/v1" + path,
                    params=params if method == "GET" else None,
                    json=params if method == "POST" else None,
                )
            except httpx.TimeoutException as exc:
                raise SourceError("timeout") from exc
            except httpx.HTTPError as exc:
                raise SourceError("unavailable") from exc
            if response.status_code == 429:
                try:
                    delay = float(response.headers.get("Retry-After", "1"))
                except ValueError:
                    delay = 1
                if delay > 5 or attempt == 2:
                    raise SourceError("rate_limited")
                await asyncio.sleep(max(delay, 0))
                continue
            if response.status_code in {401, 403, 404}:
                raise SourceError("permission_denied")
            if response.status_code >= 400:
                raise SourceError("unavailable")
            try:
                body = response.json()
                if not isinstance(body, dict):
                    raise ValueError()
                return body
            except ValueError as exc:
                raise SourceError("invalid_response") from exc
        raise SourceError("unavailable")

    async def _list(self, client, method, path):
        cursor = None
        seen = set()
        for _ in range(30):
            parameters = {"page_size": 100}
            if cursor:
                parameters["start_cursor"] = cursor
            body = await self._request(client, method, path, parameters)
            if not isinstance(body.get("results"), list) or type(body.get("has_more")) is not bool:
                raise SourceError("invalid_response")
            for item in body["results"]:
                if not isinstance(item, dict):
                    raise SourceError("invalid_response")
                yield item
            if not body["has_more"]:
                return
            cursor = body.get("next_cursor")
            if not isinstance(cursor, str) or not cursor or cursor in seen:
                raise SourceError("invalid_response")
            seen.add(cursor)
        raise SourceError("scope_limit")

    def _check_parent(self, body: dict, expected: str | None):
        if expected is None:
            return
        parent = body.get("parent") or {}
        value = parent.get(parent.get("type"))
        if not isinstance(value, str) or identifier(value) != expected:
            raise SourceError("scope_violation")

    async def records(self) -> list[Record]:
        async with self._lock:
            if monotonic() < self._expires:
                return [record.model_copy(deep=True) for record in self._snapshot]
            try:
                async with asyncio.timeout(90):
                    result = await self._load()
            except TimeoutError as exc:
                raise SourceError("timeout") from exc
            except (KeyError, TypeError, AttributeError, ValueError) as exc:
                raise SourceError("invalid_response") from exc
            self._snapshot = result
            self._expires = monotonic() + 60
            return [record.model_copy(deep=True) for record in result]

    async def clear_cache(self):
        async with self._lock:
            self._snapshot = []
            self._expires = 0

    async def _load(self) -> list[Record]:
        pages = [(root, None, None) for root in self.roots]
        records = []
        visited = set()
        blocks_seen = set()
        requests = 0
        async with httpx.AsyncClient(
            headers={"Authorization": "Bearer " + self._token, "Notion-Version": NOTION_VERSION},
            timeout=15,
            transport=self.transport,
            follow_redirects=False,
        ) as client:

            async def blocks(parent_id: str, depth: int, lines: list[str]):
                nonlocal requests
                if depth > 10 or requests >= 150:
                    raise SourceError("scope_limit")
                requests += 1
                async for block in self._list(client, "GET", f"/blocks/{parent_id}/children"):
                    block_id = identifier(block["id"])
                    if block_id in blocks_seen:
                        continue
                    blocks_seen.add(block_id)
                    if len(blocks_seen) > 2000:
                        raise SourceError("scope_limit")
                    if block.get("in_trash") or block.get("is_archived"):
                        continue
                    kind = block.get("type")
                    content = block.get(kind) or {}
                    if kind == "child_page":
                        if len(pages) + len(visited) >= 50:
                            raise SourceError("scope_limit")
                        pages.append((block_id, parent_id, None))
                        continue
                    if kind == "child_database":
                        database = await self._request(client, "GET", f"/databases/{block_id}")
                        self._check_parent(database, parent_id)
                        sources = database.get("data_sources")
                        if not isinstance(sources, list):
                            raise SourceError("invalid_response")
                        for data_source in sources:
                            data_source_id = identifier(data_source["id"])
                            async for page in self._list(
                                client, "POST", f"/data_sources/{data_source_id}/query"
                            ):
                                if page.get("object") != "page":
                                    raise SourceError("invalid_response")
                                if len(pages) + len(visited) >= 50:
                                    raise SourceError("scope_limit")
                                pages.append((identifier(page["id"]), data_source_id, page))
                        continue
                    if kind == "synced_block" and content.get("synced_from"):
                        continue
                    text = rich_text(content.get("rich_text", content.get("caption", [])))
                    if kind == "table_row":
                        text = " | ".join(rich_text(cell) for cell in content.get("cells", []))
                    if text:
                        lines.append(text)
                    if sum(map(len, lines)) > 30000:
                        raise SourceError("scope_limit")
                    if block.get("has_children"):
                        await blocks(block_id, depth + 1, lines)

            while pages:
                page_id, parent, cached = pages.pop(0)
                if page_id in visited:
                    continue
                visited.add(page_id)
                if len(visited) > 50:
                    raise SourceError("scope_limit")
                page = cached or await self._request(client, "GET", f"/pages/{page_id}")
                if identifier(page.get("id")) != page_id:
                    raise SourceError("invalid_response")
                self._check_parent(page, parent)
                if page.get("in_trash") or page.get("is_archived"):
                    continue
                properties = page.get("properties") or {}
                title = (
                    next(
                        (
                            rich_text(prop.get("title"))
                            for prop in properties.values()
                            if prop.get("type") == "title"
                        ),
                        "",
                    )
                    or "Untitled Notion page"
                )
                lines = property_lines(properties)
                await blocks(page_id, 0, lines)
                records.append(
                    Record(
                        id="notion:" + page_id,
                        title=title,
                        kind="note",
                        body="\n".join(lines) or title,
                        url=source_url(page.get("url")),
                    )
                )
        return records


_cached: tuple[tuple[str, tuple[str, ...]], NotionWorkspace] | None = None


def get_notion_source() -> NotionWorkspace:
    global _cached
    token = setting("NOTION_API_KEY")
    roots = root_ids()
    key = (hashlib.sha256(token.encode()).hexdigest(), roots)
    if _cached is None or _cached[0] != key:
        _cached = (key, NotionWorkspace(token, roots))
    return _cached[1]
