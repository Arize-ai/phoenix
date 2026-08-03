from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "submit_code_evaluator_draft"

DESCRIPTION = """\
Persist the open code-evaluator draft through the form's validated save path — the same \
create/patch mutation the Create or Update button runs. This is the terminal save; draft edits \
made with `edit_code_evaluator_draft` never persist on their own, and this tool does not modify \
the draft.
When auto-accept is on (edit_permission is bypass) and the draft is populated and valid, call this \
to commit the evaluator instead of waiting for, or asking for, a manual button click. Call it \
after you have read the draft and, when a sandbox is available, previewed it with \
`test_code_evaluator_draft`.
In bypass mode this commits immediately and returns the persisted evaluator's id and name \
(acceptedBy "auto"); report the saved evaluator only from this success result. In manual approval \
mode it persists nothing and returns an awaiting-user payload directing the user to click Create \
or Update — do not claim the evaluator was saved.
A validation, missing-prerequisite, or server error is returned as an actionable error. Treat it \
as a failed save — never report success — fix the draft and call this again.\
"""

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
class SubmitCodeEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        code_evaluator = ctx.deps.contexts.code_evaluator
        if code_evaluator is None or ctx.deps.is_viewer:
            return False
        return (
            code_evaluator.evaluator_node_id is not None or ctx.deps.sandbox_availability.has_usable
        )
