from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_llm_evaluator_draft"

DESCRIPTION = """\
Read the open LLM-evaluator draft. Returns the draft's name, description, judge prompt messages, \
model, provider, invocationParameters, outputConfigs, inputMapping, includeExplanation, \
testPayload, and form mode (`create` or `edit`). Call this before `edit_llm_evaluator_draft` or \
`test_llm_evaluator_draft` to see the current draft, and whenever the user asks what the draft \
contains or wants a review of the in-progress evaluator.
The `mode` field is either `create` (a new evaluator is being authored) or `edit` (an existing \
evaluator is being modified).
The judge prompt is the `messages` array; `outputConfigs` are the named classification annotation \
configs the judge produces. Read both before proposing edits.\
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
class ReadLlmEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.llm_evaluator is not None
