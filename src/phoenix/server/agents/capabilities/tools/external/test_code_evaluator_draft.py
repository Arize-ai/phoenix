from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "test_code_evaluator_draft"

DESCRIPTION = (
    "Run the open code-evaluator draft against its current test payload through "
    "the form preview path. Always call `read_code_evaluator_draft` first "
    "and pass the returned `revision` as `expectedRevision`; the test is rejected "
    "if the form changed since that read. This previews the draft only and does "
    "not persist, create, or update an evaluator."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "expectedRevision": {
            "type": "string",
            "description": (
                "The exact revision returned by the latest `read_code_evaluator_draft` call."
            ),
        },
    },
    "required": ["expectedRevision"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class TestCodeEvaluatorDraftCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.code_evaluator is not None
            and ctx.deps.sandbox_availability.has_usable
            and not ctx.deps.is_viewer
        )
