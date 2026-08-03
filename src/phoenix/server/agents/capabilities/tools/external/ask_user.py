from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "ask_user"

DESCRIPTION = """\
Ask the user one or more structured questions to gather preferences, clarify requirements, or get \
decisions. Use this when you need user input before proceeding with a task.
Keep the number of questions small (1-5 per call); prefer fewer, focused questions.
Write clear, concise prompts. Avoid jargon unless the user has used it first.
Use the `freeform` question type only when the answer space is truly open-ended; otherwise offer \
`single`/`multi` options and set `allow_freeform` when the user might want a value outside your \
list. Set `allow_skip` for optional questions.
After receiving answers, summarize what you understood and proceed. Do not re-ask the same \
questions.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "description": "List of questions to ask the user",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": (
                            "Unique identifier for this question (e.g., 'q-format', 'q-count')"
                        ),
                    },
                    "prompt": {
                        "type": "string",
                        "description": "The question text to display to the user",
                    },
                    "type": {
                        "type": "string",
                        "enum": ["single", "multi", "freeform"],
                        "description": (
                            "single = pick one option, multi = pick multiple options, "
                            "freeform = open text input"
                        ),
                    },
                    "options": {
                        "type": "array",
                        "description": (
                            "Available choices (required for single/multi, omit for freeform). "
                            "Maximum 4 options total--if allow_freeform is true, provide at most "
                            "3 options here since freeform counts toward the limit."
                        ),
                        "maxItems": 4,
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "Unique identifier for this option",
                                },
                                "label": {
                                    "type": "string",
                                    "description": "Display text for this option",
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Optional explanation of what this option means",
                                },
                            },
                            "required": ["id", "label"],
                        },
                    },
                    "allow_skip": {
                        "type": "boolean",
                        "default": False,
                        "description": (
                            "If true, user can skip this question without selecting any option. "
                            "Only applies to single/multi types."
                        ),
                    },
                    "allow_freeform": {
                        "type": "boolean",
                        "default": False,
                        "description": (
                            "If true, adds a 'Type your own answer' option. Only applies to "
                            "single/multi types. Note: counts toward the 4-option limit, so "
                            "provide at most 3 predefined options when enabled."
                        ),
                    },
                },
                "required": ["id", "prompt", "type"],
            },
        },
    },
    "required": ["questions"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class AskUserCapability(AbstractToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
