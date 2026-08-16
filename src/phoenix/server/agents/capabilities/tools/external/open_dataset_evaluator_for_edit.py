from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.context import PlaygroundEvaluatorContext
from phoenix.server.agents.types import AgentDependencies

NAME = "open_dataset_evaluator_for_edit"

DESCRIPTION = (
    "Open an existing dataset evaluator's edit form in the mounted playground "
    "without navigating away. Use this when the user wants to change an existing "
    "code or LLM evaluator's configuration. After it opens, use the draft tools "
    "that appear to read and propose edits. Only code and LLM evaluators are "
    "editable here; built-in evaluators are not supported. It does not select "
    "which evaluators run or persist any change."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetEvaluatorId": {
            "type": "string",
            "minLength": 1,
            "description": (
                "Id of the existing code or LLM evaluator to open for editing, "
                "taken from the playground roster."
            ),
        },
    },
    "required": ["datasetEvaluatorId"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


def _is_editable(evaluator: PlaygroundEvaluatorContext) -> bool:
    """Mirror the UI's compound (kind, isBuiltIn) editability gate: only code and
    LLM evaluators that are not built-in flagged route to a draft-edit form."""
    return evaluator.kind in ("CODE", "LLM") and not evaluator.is_builtin


@dataclass
class OpenDatasetEvaluatorForEditCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        playground = ctx.deps.contexts.playground
        if playground is None or ctx.deps.contexts.dataset is None or ctx.deps.is_viewer:
            return False
        return any(_is_editable(evaluator) for evaluator in playground.evaluators)
