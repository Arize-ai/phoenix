from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass

from jinja2 import Template
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc, ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.capabilities.tools.external.evaluator_draft_preview import (
    PREVIEW_PARAMETERS,
)
from phoenix.server.agents.types import AgentDependencies

# Model-facing tool name stays `test_code_evaluator_draft` (test-run the draft);
# the module and class use `run` so pytest does not collect this as a test.
NAME = "test_code_evaluator_draft"

DESCRIPTION = (
    "Run the open code-evaluator draft through the form preview path. Omit cases "
    "to use the form's current test payload, or provide named cases to test multiple "
    "payload overrides without changing the form or requiring edit approval. This "
    "previews only and does not persist, create, or update an evaluator."
)


# Deep-copied so this tool's schema is independent of run_llm_evaluator_draft's
# -- the two previously aliased the same dict object, which would let an
# in-place mutation of one tool's schema silently corrupt the other's.
PARAMETERS = deepcopy(PREVIEW_PARAMETERS)

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class RunCodeEvaluatorDraftCapability(AbstractDynamicCapability[AgentDependencies]):
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
