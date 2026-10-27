import re
from time import perf_counter

from reliability_lab.domain import AgentAnswer, Citation, Claim, QueryRequest, Record
from reliability_lab.workspace import DataSource, relevance, retrieve, tokens


def mock_answer(question: str, evidence: list[Record]) -> AgentAnswer:
    if re.search(r"\b(create|update|delete|remove|change|move|assign|execute)\b", question, re.I):
        return AgentAnswer(
            answer=(
                "A workspace mutation needs a validated proposal and explicit confirmation. "
                "No action was executed."
            ),
            abstained=True,
            reason="action_requires_confirmation",
            sources=evidence,
        )
    query = tokens(question)
    dimensions = {"release", "owner", "blocker", "budget", "status", "due", "decision"}
    requested = query & dimensions
    if "who" in question.lower().split():
        requested.add("owner")
    candidates = []
    project_names = {
        fact.subject.split("/")[0].lower() for record in evidence for fact in record.facts
    }
    if len(project_names) > 1 and not project_names & query:
        return AgentAnswer(
            answer=(
                "The project reference is ambiguous. Specify a project before relying on an answer."
            ),
            abstained=True,
            reason="insufficient_evidence",
            sources=evidence,
        )
    for record in evidence:
        for fact in record.facts:
            if "/" in fact.subject:
                detail = tokens(fact.subject.split("/", 1)[1])
                if not detail & query and not ({"blocker", "task"} & query):
                    continue
            if requested and fact.predicate not in requested:
                continue
            # A project name alone is not evidence for an unsupported question.
            if not requested and relevance(question, fact.predicate + " " + fact.value) == 0:
                continue
            if fact.quote in record.body:
                candidates.append((record, fact))
    if not candidates:
        return AgentAnswer(
            answer="The retrieved evidence is insufficient to answer this question.",
            abstained=True,
            reason="insufficient_evidence",
            sources=evidence,
        )
    values: dict[tuple[str, str], set[str]] = {}
    for _, fact in candidates:
        values.setdefault((fact.subject, fact.predicate), set()).add(fact.value)
    if any(len(items) > 1 for items in values.values()):
        return AgentAnswer(
            answer=(
                "The sources contain conflicting information. "
                "Confirm the current decision before relying on either value."
            ),
            abstained=True,
            reason="conflicting_evidence",
            sources=evidence,
        )
    claims = []
    seen = set()
    for record, fact in candidates:
        key = (fact.subject, fact.predicate, fact.value)
        if key in seen:
            continue
        seen.add(key)
        claims.append(
            Claim(text=fact.quote, citations=[Citation(record_id=record.id, quote=fact.quote)])
        )
    return AgentAnswer(
        answer="\n".join(claim.text for claim in claims),
        claims=claims,
        reason="answered",
        sources=evidence,
    )


class Agent:
    def __init__(self, source: DataSource):
        self.source = source

    async def query(self, request: QueryRequest) -> AgentAnswer:
        started = perf_counter()
        evidence = retrieve(request.question, await self.source.records(), request.top_k)
        answer = mock_answer(request.question, evidence)
        answer.latency_ms = round((perf_counter() - started) * 1000, 3)
        return answer
