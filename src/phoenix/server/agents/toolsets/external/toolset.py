from __future__ import annotations

from pydantic_ai._run_context import RunContext
from pydantic_ai.messages import InstructionPart
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    ExternalToolDefinition,
)


class ExternalToolsetWithInstructions(ExternalToolset[ChatDependencies]):
    """ExternalToolset that surfaces per-tool instructions as toolset instructions."""

    async def get_instructions(
        self, ctx: RunContext[ChatDependencies]
    ) -> list[InstructionPart] | None:
        parts = [
            tool_def.get_instruction_part(ctx)
            for tool_def in self.tool_defs
            if isinstance(tool_def, ExternalToolDefinition)
        ]
        return parts or None
