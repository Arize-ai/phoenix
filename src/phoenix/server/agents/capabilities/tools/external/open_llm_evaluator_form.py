from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "open_llm_evaluator_form"

DESCRIPTION = """\
Open the dataset-backed LLM-evaluator form from the current playground without navigating away. The browser remains on the current playground route and keeps the playground/dataset state intact. Use this when a dataset is mounted in the playground and the user wants to author an LLM-as-a-judge evaluator, and the form is not already mounted (so `read_llm_evaluator_draft` is not yet available). This opens the existing create-LLM-evaluator form; it does not persist or create an evaluator.
The tool name is internal. In replies to users, call the opened surface the LLM-evaluator form or evaluator form, and do not describe creating as approving a diff — creating the evaluator is a separate save step.
Before authoring an LLM evaluator, `load_skill` the `evaluators` skill for the evaluator authoring methodology. Call `open_llm_evaluator_form` first, then wait for the LLM-evaluator context and draft tools to appear. After the form is mounted, call `read_llm_evaluator_draft`, then propose changes with `edit_llm_evaluator_draft`. For testing and persisting the populated draft, follow the `<phoenix_llm_evaluator_context>` guidance; whether you drive the save yourself or defer to the form's Create action depends on the approval mode stated there. Do not claim the evaluator has been created until its save actually completes."""

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


@dataclass
class OpenLlmEvaluatorFormCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.playground is not None
            and ctx.deps.contexts.dataset is not None
            and ctx.deps.contexts.llm_evaluator is None
            and ctx.deps.model_provider_availability.has_usable
            and not ctx.deps.is_viewer
        )
