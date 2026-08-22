from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_template_variables_path"

DESCRIPTION = """\
Set the dataset field path that playground template variables resolve against, when a prompt references dataset fields outside the default `input` root. Set it proactively when prompt variables reference fields outside `input` and resolve empty — don't wait for the user to ask.
The path selects which dataset field a variable name resolves against (`input`, `reference`, or `metadata`); an empty string or null means the whole example (the example root).
Variable names are relative to this path: a name's first segment must be a key at the path. Under `input`, a field is named `question`; at the example root, the same field is `input.question` and an output field is `reference.answer`.
Changing the path changes which names resolve, so the prompt's variable names must match the new root. This tool changes only the path, not prompt messages; rename the references with `edit_prompt_instance`.
This only updates browser UI state and only applies when a dataset is loaded. If no dataset is loaded, call `load_dataset` first."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "path": {
            "type": ["string", "null"],
            "description": (
                "The dataset field path (e.g. `input`, `reference`, `metadata`) that "
                "template variables resolve against. Empty string or null means the whole "
                "example (the example root)."
            ),
        },
    },
    "required": ["path"],
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
class SetTemplateVariablesPathCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
