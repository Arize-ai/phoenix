"""A networkless ``bash`` tool for the server agent.

Runs commands inside an in-memory just-bash virtual shell (no host access, no
network) and exposes a custom ``phoenix-gql`` binary that executes read-only
GraphQL against the Strawberry schema in-process. The agent can therefore run
GraphQL and pipe the JSON result through sandbox tools such as ``jq``.

The virtual filesystem is created fresh for each ``BashToolset`` (i.e. each agent
build). Because a new server agent is built per ``call_subagent`` invocation, the
filesystem is effectively scoped to a single sub-agent invocation: files written
under the workspace persist across the bash calls within that invocation, but not
across separate invocations.

just-bash is vendored under :mod:`phoenix.vendor.just_bash` (a pure-Python bash
interpreter), so the tool is available on every supported interpreter, including
Python 3.10.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Optional

import strawberry
from pydantic_ai import Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from phoenix.vendor.just_bash import Bash, InMemoryFs

NAME = "bash"

#: Cap on the text returned to the model so a runaway command cannot blow up the
#: context window. The agent should redirect large output to a workspace file.
MAX_OUTPUT_CHARS = 30_000

#: Working directory for the sandbox; the only place writes are expected to land.
WORKSPACE_ROOT = "/home/user/workspace"

DESCRIPTION = """\
Run a shell command in a networkless just-bash virtual filesystem.
Runs inside an in-memory just-bash shell, not a host machine, container, or the network.
Write scratch files under /home/user/workspace (the working directory).
General-purpose network access is disabled; curl/wget and remote installs do not work.
Built-in just-bash commands (cat, grep, sed, awk, sort, jq, sqlite3, etc.) are available; \
do not assume host binaries like python, node, git, uv, or apt exist.
phoenix-gql is available for read-only GraphQL against the Phoenix schema (executed \
in-process, not over the network). Run `phoenix-gql --help` for usage. Pipe its JSON \
output through jq to extract what you need, e.g. \
`phoenix-gql '{ projects { edges { node { name } } } }' --data-only | jq '.data'`.\
"""


def _new_filesystem() -> InMemoryFs:
    """Create a fresh in-memory filesystem seeded with the scratch workspace."""
    from phoenix.vendor.just_bash import InMemoryFs

    return InMemoryFs(initial_files={f"{WORKSPACE_ROOT}/.keep": ""})


def _build_runtime(
    *,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    filesystem: InMemoryFs,
) -> Bash:
    """Construct a just-bash runtime around ``filesystem`` with ``phoenix-gql``.

    The vendored just-bash is imported lazily to keep this module's import cheap.
    """
    from phoenix.server.agents.capabilities.tools.internal.phoenix_gql_command import (
        PhoenixGqlCommand,
    )
    from phoenix.vendor.just_bash import Bash
    from phoenix.vendor.just_bash.commands.registry import create_command_registry

    # Start from the full built-in registry (jq, grep, sed, ...) without the
    # network commands, then register phoenix-gql, mirroring how just-bash itself
    # conditionally registers curl.
    registry = create_command_registry(include_network=False)
    registry[PhoenixGqlCommand.name] = PhoenixGqlCommand(
        schema=schema,
        build_graphql_context=build_graphql_context,
    )
    return Bash(
        commands=registry,
        fs=filesystem,
        cwd=WORKSPACE_ROOT,
    )


def _format_result(stdout: str, stderr: str, exit_code: int) -> str:
    if exit_code == 0 and not stderr:
        body = stdout if stdout else "(command produced no output)"
        return _truncate(body)
    sections = [f"exit code: {exit_code}"]
    if stdout:
        sections.append(f"--- stdout ---\n{stdout}")
    if stderr:
        sections.append(f"--- stderr ---\n{stderr}")
    return _truncate("\n".join(sections))


def _truncate(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    omitted = len(text) - MAX_OUTPUT_CHARS
    return (
        text[:MAX_OUTPUT_CHARS]
        + f"\n... [truncated {omitted} characters; redirect large output to a "
        f"file under {WORKSPACE_ROOT} and inspect it with jq/grep]"
    )


class BashToolset(FunctionToolset[None]):
    """Toolset exposing a single networkless ``bash`` tool to the server agent.

    A fresh filesystem and runtime are created per toolset and reused across bash
    calls within an agent run, so workspace files persist for the lifetime of that
    sub-agent invocation. Pass ``filesystem`` to reuse an existing one (e.g. tests).
    """

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
        filesystem: Optional[InMemoryFs] = None,
    ) -> None:
        runtime = _build_runtime(
            schema=schema,
            build_graphql_context=build_graphql_context,
            filesystem=filesystem if filesystem is not None else _new_filesystem(),
        )

        async def bash(command: str, summary: str) -> str:
            result = await runtime.exec(command)
            return _format_result(result.stdout, result.stderr, result.exit_code)

        super().__init__(tools=[Tool(bash, takes_ctx=False, description=DESCRIPTION)])


@dataclass
class BashCapability(AbstractStaticCapability[None]):
    """Capability that adds the networkless ``bash`` tool to an agent.

    Each agent build gets its own virtual filesystem (see :class:`BashToolset`).
    """

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str

    def get_toolset(self) -> AgentToolset[None] | None:
        return BashToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
        )

    def get_static_instructions(self) -> str:
        return self.instructions


__all__ = ["BashCapability", "BashToolset"]
