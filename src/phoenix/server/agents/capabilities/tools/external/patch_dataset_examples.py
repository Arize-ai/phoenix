from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "patch_dataset_examples"

DESCRIPTION = """\
Edit existing examples of the dataset the user is viewing. Each patch targets an example by id and updates its input, output, and/or metadata; omitted fields on a patch are left unchanged. This creates a new dataset version.
Get each example's id from list_dataset_examples — do not guess ids — and pass only the fields you intend to change on each example.
To add new examples use add_dataset_examples; to remove examples use delete_dataset_examples.
Propose the edit by calling this tool directly. In manual approval mode the browser renders an inline accept/reject card and applies it only when the user accepts; in bypass mode it is applied immediately. The card is the approval surface — do not ask a separate yes/no question (or call ask_user) to confirm before calling it."""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "patches": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "exampleId": {
                        "type": "string",
                        "minLength": 1,
                        "description": "The id of the example to edit (from list_dataset_examples).",
                    },
                    "input": {"type": "object", "description": "New input object for the example."},
                    "output": {
                        "type": "object",
                        "description": "New output object for the example.",
                    },
                    "metadata": {
                        "type": "object",
                        "description": "New metadata object for the example.",
                    },
                },
                "required": ["exampleId"],
                "additionalProperties": False,
            },
            "description": "The example edits to apply.",
        },
        "versionDescription": {
            "type": ["string", "null"],
            "description": "An optional note describing the new dataset version.",
        },
    },
    "required": ["patches"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class PatchDatasetExamplesCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        # Writes are blocked server-side for viewers; don't advertise to them.
        return ctx.deps.contexts.dataset is not None and not ctx.deps.is_viewer
