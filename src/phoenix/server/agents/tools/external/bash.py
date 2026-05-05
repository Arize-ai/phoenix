from __future__ import annotations

from typing import Any

from pydantic_ai.tools import ToolDefinition

BASH_TOOL_NAME = "bash"

# Keep the public tool description aligned with the server-owned system-prompt
# guidance in ``phoenix.server.agents.prompts``.
_BASH_TOOL_CAPABILITY_LINES = [
    "Runs inside a browser-only just-bash virtual shell, not a host machine or container.",
    "Read Phoenix context from /phoenix; writes there are blocked.",
    "Write scratch files only under /home/user/workspace; mutations elsewhere are blocked.",
    "General purpose network access is disabled, so curl/wget and remote package installs "
    "should not be assumed to work.",
    "Built-in just-bash commands are available; do not assume apt, brew, pnpm, uv, git, "
    "or other host binaries exist unless the sandbox reports them.",
    "The user has no access to the filesystem. You can use the filesystem for your own "
    "purposes, but if you want to share something with the user, you must display the "
    "content in the rich markdown rendered chat.",
    "phoenix-gql is available for GraphQL operations against the Phoenix GraphQL API. "
    "Run phoenix-gql --help for usage and current permissions.",
]

_BASH_TOOL_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "command": {
            "type": "string",
            "description": "Shell command to execute",
        },
    },
    "required": ["command"],
    "additionalProperties": False,
}

BASH_TOOL_DEFINITION = ToolDefinition(
    name=BASH_TOOL_NAME,
    description=(
        "Run a shell command in the browser virtual filesystem. "
        + " ".join(_BASH_TOOL_CAPABILITY_LINES)
    ),
    parameters_json_schema=_BASH_TOOL_PARAMETERS,
    kind="external",
)
