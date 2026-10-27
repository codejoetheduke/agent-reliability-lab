import asyncio

import httpx

from reliability_lab.agent import Agent
from reliability_lab.domain import QueryRequest
from reliability_lab.main import app
from reliability_lab.workspace import SyntheticWorkspace, retrieve


def query(question):
    return asyncio.run(Agent(SyntheticWorkspace()).query(QueryRequest(question=question)))


def test_project_owner_is_grounded_and_not_other_task_owners():
    answer = query("Who owns Atlas?")
    assert len(answer.claims) == 1
    assert "Maya Chen" in answer.answer
    assert answer.simulated
    assert answer.claims[0].citations[0].record_id == "atlas-plan"


def test_multi_source_release_and_blocker():
    answer = query("What are Atlas release and blockers?")
    assert "2026-11-12" in answer.answer
    assert "unfinished security review" in answer.answer
    assert {c.record_id for claim in answer.claims for c in claim.citations} == {
        "atlas-plan",
        "atlas-meeting",
    }


def test_citations_always_reference_retrieved_verbatim_text():
    answer = query("What is the Atlas migration deadline?")
    records = {record.id: record for record in answer.sources}
    assert "2026-11-05" in answer.answer
    for claim in answer.claims:
        for citation in claim.citations:
            assert citation.quote in records[citation.record_id].body
    assert all(record.url is None for record in records.values())


def test_missing_project_abstains():
    assert query("What is Orion release date?").reason == "insufficient_evidence"


def test_missing_field_abstains():
    assert query("What is Atlas revenue?").abstained


def test_conflicting_values_abstain():
    assert query("What is Cedar budget?").reason == "conflicting_evidence"


def test_action_request_does_not_execute():
    assert query("Create an Atlas task").reason == "action_requires_confirmation"


def test_retrieval_never_mixes_explicit_projects():
    records = asyncio.run(SyntheticWorkspace().records())
    assert all("Atlas" in record.title for record in retrieve("Atlas status", records, 4))


def test_endpoint_and_request_validation():
    async def check():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            assert (
                await client.post("/agent/query", json={"question": "Who owns Atlas?"})
            ).status_code == 200
            assert (
                await client.post("/agent/query", json={"question": "", "top_k": 50})
            ).status_code == 422

    asyncio.run(check())
