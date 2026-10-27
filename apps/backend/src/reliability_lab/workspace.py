"""Inspectable lexical retrieval over authorized source records."""

import json
import re
from pathlib import Path
from typing import Protocol

from reliability_lab.domain import Record

STOP_WORDS = set(
    (
        "a an and are as at be by can do for from has have how i in is it me my of on or "
        "please tell that the this to us was what when which who will with would you"
    ).split()
)
ALIASES = {
    "deadline": "due",
    "deadlines": "due",
    "launch": "release",
    "ship": "release",
    "shipping": "release",
    "blocked": "blocker",
    "blockers": "blocker",
    "owns": "owner",
    "responsible": "owner",
    "leading": "owner",
    "budgets": "budget",
    "tasks": "task",
    "decisions": "decision",
}


def tokens(text: str) -> set[str]:
    return {
        ALIASES.get(word, word)
        for word in re.findall(r"[a-z0-9]+", text.lower())
        if word not in STOP_WORDS
    }


class DataSource(Protocol):
    strict_anchors: bool

    async def records(self) -> list[Record]: ...


class SyntheticWorkspace:
    strict_anchors = True

    def __init__(self, records: list[Record] | None = None):
        if records is None:
            path = Path(__file__).parent / "fixtures" / "workspace.json"
            records = [Record.model_validate(item) for item in json.loads(path.read_text())]
        self._records = records

    async def records(self) -> list[Record]:
        return [record.model_copy(deep=True) for record in self._records]


def relevance(question: str, text: str) -> int:
    return len(tokens(question) & tokens(text))


def retrieve(
    question: str, records: list[Record], top_k: int, *, strict_anchors: bool = True
) -> list[Record]:
    query = tokens(question)
    # Known project names act as scope filters, preventing cross-project evidence mixing.
    projects = {fact.subject.lower().split("/")[0] for record in records for fact in record.facts}
    scope = query & projects
    generic = {
        "release",
        "owner",
        "blocker",
        "budget",
        "status",
        "due",
        "decision",
        "project",
        "task",
        "date",
        "current",
        "scheduled",
        "latest",
        "about",
        "information",
        "give",
        "all",
        "name",
    }
    anchors = query - generic
    ranked = []
    for record in records:
        record_tokens = tokens(record.title + " " + record.body)
        if scope and not scope & record_tokens:
            continue
        if strict_anchors and anchors and not anchors <= record_tokens:
            continue
        score = len(query & record_tokens) + len(query & tokens(record.title))
        if score:
            ranked.append((score, record.id, record))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in ranked[:top_k]]
