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

NAME = "read_dataset_evaluator_definition"

MAX_EVALUATOR_IDS = 5

DESCRIPTION = (
    "Read the full definition of one or a few existing dataset evaluators by id, "
    "without opening any form. Use this to inspect an evaluator's body before "
    "comparing, selecting, or proposing edits: code evaluators return source, "
    "language, sandbox, and mappings; LLM evaluators return judge messages, model "
    "config, and output configs; built-in evaluators return metadata, input "
    "schema, and output configs. Pass evaluator ids from the playground roster; "
    f"read at most {MAX_EVALUATOR_IDS} at a time. Long body fields may be "
    "truncated with a marker; open the evaluator for edit to read the full "
    "source. It does not edit, select, or create evaluators."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "datasetEvaluatorIds": {
            "type": "array",
            "description": (
                "Ids of the dataset evaluators to read, taken from the playground "
                "roster. Prefer reading the few evaluators you actually need."
            ),
            "items": {"type": "string", "minLength": 1},
            "minItems": 1,
            "maxItems": MAX_EVALUATOR_IDS,
        },
    },
    "required": ["datasetEvaluatorIds"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ReadDatasetEvaluatorDefinitionCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return instructions.render()

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Pure read, so not viewer-gated, matching read_code_evaluator_draft and the
        # list_* tools; only writes/runs gate on is_viewer.
        playground = ctx.deps.contexts.playground
        return (
            playground is not None
            and ctx.deps.contexts.dataset is not None
            and bool(playground.evaluators)
        )
