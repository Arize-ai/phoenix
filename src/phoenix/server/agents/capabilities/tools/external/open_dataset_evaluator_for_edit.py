from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.context import PlaygroundEvaluatorContext
from phoenix.server.agents.types import AgentDependencies

NAME = "open_dataset_evaluator_for_edit"

DESCRIPTION = """\
Open an existing dataset evaluator's edit form in the mounted playground without navigating away. The browser stays on the current playground route and keeps the playground/dataset state intact. Use this when the user wants to change an existing code or LLM evaluator's configuration (prompt, code, mapping, or output config); identify the target by name from the playground roster and pass its `datasetEvaluatorId`. It does not select which evaluators run or persist any change.
The tool name is internal. In replies to users, call the opened surface the evaluator form, and do not describe saving as approving a diff — saving is the form's Save action.
Call `open_dataset_evaluator_for_edit` first, then wait for the evaluator context and draft tools to appear. After the form is mounted, call the matching `read_*_evaluator_draft`, then propose changes with `edit_*_evaluator_draft`. For testing and saving, follow the mounted `<phoenix_code_evaluator_context>` or `<phoenix_llm_evaluator_context>` guidance — it is permission-aware and, under auto-accept, drives the populated draft through the matching `test_*_evaluator_draft` and `submit_*_evaluator_draft` automatically. Do not prescribe a manual Save step or claim the evaluator was updated until that save's success result comes back; let the mounted context govern persistence.
Only code and LLM evaluators can be opened here. If the user asks to edit a built-in evaluator, tell them built-in evaluators are not yet editable via the assistant.
If another evaluator form is already open (a create or edit form), this call is rejected. Ask the user to close the open form, then retry — do not try to discard their in-progress draft yourself."""

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
class OpenDatasetEvaluatorForEditCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        playground = ctx.deps.contexts.playground
        if playground is None or ctx.deps.contexts.dataset is None or ctx.deps.is_viewer:
            return False
        return any(_is_editable(evaluator) for evaluator in playground.evaluators)
