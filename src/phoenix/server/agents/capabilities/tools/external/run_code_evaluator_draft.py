from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

# Model-facing tool name stays `test_code_evaluator_draft` (test-run the draft);
# the module and class use `run` so pytest does not collect this as a test.
NAME = "test_code_evaluator_draft"

DESCRIPTION = """\
Run the open code-evaluator draft against its current test payload through the form preview path and return the preview result. Use it after reading the draft when the user asks for or agrees to a preview test, or when you need execution feedback before deciding whether to revise the evaluator or test payload again. Call `read_code_evaluator_draft` first if you want to confirm the current draft before testing.
Treat preview failures as iteration signals: inspect the error/result, revise the source or `testPayload`, and test again.
This previews the draft only; it does not persist, create, or update an evaluator."""

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
    defer_loading=True,
)


@dataclass
class RunCodeEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.code_evaluator is not None
            and ctx.deps.sandbox_availability.has_usable
            and not ctx.deps.is_viewer
        )
