from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "open_experiment_evaluator_form"

DESCRIPTION = (
    "Open the dataset-backed code-evaluator form from the current playground "
    "without navigating away. Use this when a dataset is mounted in the playground "
    "and the user wants to author an experiment evaluator. This opens the existing "
    "create-code-evaluator form; it does not save or create an evaluator."
)

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)

INSTRUCTIONS = "\n".join(
    (
        '<tool name="open_experiment_evaluator_form">',
        "  <description>Open the mounted playground's dataset-backed "
        "code-evaluator form in place. The browser remains on the "
        "current playground route and keeps the playground/dataset state "
        "intact.</description>",
        "  <when_to_use>",
        "    - The user is in a dataset-backed playground and asks to create, "
        "author, or iterate on a code evaluator for experiment scoring.",
        "    - The create/edit code-evaluator form is not already mounted, so "
        "`read_code_evaluator_draft` is not yet available.",
        "  </when_to_use>",
        "  <user_facing_language>",
        "    - The tool name is internal. In replies to users, call the "
        "opened surface the code-evaluator form or evaluator form.",
        "    - Do not describe saving as approving a diff. The user saves "
        "with the form's Save action when ready.",
        "  </user_facing_language>",
        "  <workflow>",
        "    - Call `open_experiment_evaluator_form` first, then wait for "
        "the code-evaluator context and draft tools to appear.",
        "    - After the form is mounted, call `read_code_evaluator_draft`, "
        "then propose changes with `edit_code_evaluator_draft`.",
        "    - After the user accepts a populated draft, offer to run "
        "`test_code_evaluator_draft` before they save.",
        "    - Do not promise that the evaluator has been saved. Persistence "
        "stays behind the user-visible Save action in the form.",
        "  </workflow>",
        "</tool>",
    )
)


@dataclass
class OpenExperimentEvaluatorFormCapability(AbstractDynamicCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        def _instructions(ctx: RunContext[AgentDependencies]) -> str:
            return INSTRUCTIONS

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.playground is not None
            and ctx.deps.contexts.dataset is not None
            and ctx.deps.contexts.code_evaluator is None
            and ctx.deps.sandbox_availability.has_usable
            and not ctx.deps.is_viewer
        )
