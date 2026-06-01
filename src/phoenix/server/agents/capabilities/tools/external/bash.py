from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "bash"

DESCRIPTION = """\
Run a shell command in the browser virtual filesystem.
Runs inside a browser-only just-bash virtual shell, not a host machine or container.
Read Phoenix context from /phoenix; writes there are blocked.
Write scratch files only under /home/user/workspace; mutations elsewhere are blocked.
General purpose network access is disabled, so curl/wget and remote package installs \
should not be assumed to work.
Built-in just-bash commands are available; do not assume apt, brew, pnpm, uv, git, \
or other host binaries exist unless the sandbox reports them.
Language runtimes such as python, python3, and node are not available.
The user has no access to the filesystem. You can use the filesystem for your own \
purposes, but if you want to share something with the user, you must display the \
content in the rich markdown rendered chat.
phoenix-gql is available for GraphQL operations against the Phoenix GraphQL API. \
Run phoenix-gql --help for usage and current permissions.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": (
                "Short, user-facing description of what this command does, "
                "shown as the collapsed preview in the UI. Convey the "
                "high-level goal and what this specific call is meant to "
                "accomplish, not just the literal shell action. Frame it "
                "around the user's data and goals; the filesystem, internal "
                "files, and agent setup are implementation details, so do not "
                "mention them. Use active voice and 5-10 words. Examples: "
                '"Find traces with tool errors to triage", "Orienting myself '
                'to your data", "Reviewing your project setup".'
            ),
        },
        "command": {
            "type": "string",
            "description": "Shell command to execute",
        },
    },
    "required": ["summary", "command"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class BashCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
