from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class SpanContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: str

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            span = ctx.deps.contexts.span
            if span is None:
                return None
            if span.span_node_id is not None:
                element = (
                    f'<span_node_id format="phoenix_node_id">{span.span_node_id}</span_node_id>'
                )
            else:
                assert span.otel_span_id is not None
                element = f'<otel_span_id format="otel_hex">{span.otel_span_id}</otel_span_id>'
            if span.project_node_id is not None:
                project_node_id_element = (
                    f'\n  <project_node_id format="phoenix_node_id">'
                    f"{span.project_node_id}</project_node_id>"
                )
            else:
                project_node_id_element = ""
            return instructions.format(
                project_node_id_element=project_node_id_element,
                span_id_element=element,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.span is not None
