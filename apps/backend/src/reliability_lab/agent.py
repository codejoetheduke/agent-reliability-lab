import re
from time import perf_counter

from reliability_lab.domain import AgentAnswer, QueryRequest
from reliability_lab.mock_provider import mock_answer
from reliability_lab.providers import MockProvider, Provider, validate_answer
from reliability_lab.workspace import DataSource, retrieve


class Agent:
    def __init__(self, source: DataSource, provider: Provider | None = None):
        self.source = source
        self.provider = provider or MockProvider()

    async def query(self, request: QueryRequest) -> AgentAnswer:
        started = perf_counter()
        evidence = retrieve(
            request.question,
            await self.source.records(),
            request.top_k,
            strict_anchors=getattr(self.source, "strict_anchors", True),
        )
        if re.search(
            r"\b(create|update|delete|remove|change|move|assign|execute)\b", request.question, re.I
        ):
            answer = mock_answer(request.question, evidence)
            if not self.provider.simulated:
                # A local refusal is not a hosted answer or a simulated model call.
                answer.provider = "policy"
                answer.model = "local-action-policy-v1"
                answer.simulated = False
                answer.input_tokens = 0
                answer.output_tokens = 0
                answer.estimated_cost_usd = 0
            answer.latency_ms = round((perf_counter() - started) * 1000, 3)
            return answer
        result = await self.provider.generate(request.question, evidence)
        validated = validate_answer(result.data, evidence)
        return AgentAnswer(
            **validated.model_dump(),
            sources=evidence,
            provider=self.provider.name,
            simulated=self.provider.simulated,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            estimated_cost_usd=result.estimated_cost_usd,
            provider_latency_ms=result.latency_ms,
            latency_ms=round((perf_counter() - started) * 1000, 3),
        )
