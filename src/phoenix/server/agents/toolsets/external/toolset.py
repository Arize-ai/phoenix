from __future__ import annotations

from pydantic_ai._run_context import RunContext
from pydantic_ai.messages import InstructionPart
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    ExternalToolDefinition,
)
from phoenix.server.agents.types import AgentDependencies


class ExternalToolsetWithInstructions(ExternalToolset[AgentDependencies]):
    """ExternalToolset that surfaces per-tool instructions as toolset instructions."""

    async def get_instructions(
        self, ctx: RunContext[AgentDependencies]
    ) -> list[InstructionPart] | None:
        parts = [
            tool_def.get_instruction_part(ctx)
            for tool_def in self.tool_defs
            if isinstance(tool_def, ExternalToolDefinition)
        ]
        return parts or None
