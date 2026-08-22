from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

# Class and module use `run` (not `test`) so pytest does not collect them as tests.
NAME = "test_llm_evaluator_draft"

DESCRIPTION = """\
Run the open LLM-evaluator draft's judge against its current test payload through the form preview path and return the preview result. Use it after reading the draft when the user asks for or agrees to a preview test, or when you need judge output before deciding whether to revise the judge prompt, model, output configs, or test payload again. Call `read_llm_evaluator_draft` first if you want to confirm the current draft before testing.
The preview result reports the judge's label and `explanation` on success, or an `error` when the judge run fails (for example a missing model-provider credential). Treat an error as an iteration signal: inspect it, revise the judge prompt or `testPayload`, and test again.
This runs the judge only; it does not persist, create, or update an evaluator."""

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
class RunLlmEvaluatorDraftCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return (
            ctx.deps.contexts.llm_evaluator is not None
            and ctx.deps.model_provider_availability.has_usable
            and not ctx.deps.is_viewer
        )
