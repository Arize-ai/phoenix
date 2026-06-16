"""A networkless ``bash`` tool for the server agent.

Runs commands inside an in-memory bashkit virtual shell (no host access, no
network) and exposes a custom ``phoenix-gql`` binary that executes read-only
GraphQL against the Strawberry schema in-process. The agent can therefore run
GraphQL and pipe the JSON result through sandbox tools such as ``jq``.

The virtual filesystem is created fresh for each ``BashToolset`` (i.e. each agent
build). Because a new server agent is built per ``call_subagent`` invocation, the
filesystem is effectively scoped to a single sub-agent invocation: files written
under the workspace persist across the bash calls within that invocation, but not
across separate invocations.

The sandbox is `bashkit <https://pypi.org/project/bashkit/>`_, a Rust bash
interpreter exposed to Python as a native (PyO3) extension. It ships as a small
per-platform wheel, so the heavy interpreter no longer lives in the Phoenix
source tree (it replaces the vendored ``phoenix.vendor.just_bash`` port).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Optional, Union

import bashkit
import strawberry
from jinja2 import Template
from pydantic_ai import Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

NAME = "bash"

#: Cap on the text returned to the model so a runaway command cannot blow up the
#: context window. The agent should redirect large output to a workspace file.
MAX_OUTPUT_CHARS = 30_000

#: Working directory for the sandbox; the only place writes are expected to land.
WORKSPACE_ROOT = "/home/user/workspace"

#: Wall-clock cap on a single ``exec`` so a runaway command cannot hang the agent.
EXEC_TIMEOUT_SECONDS = 30

#: bashkit's initial-files mapping: VFS path -> contents (or a lazy callable).
FileSeed = Dict[str, Union[str, Callable[[], str]]]

_DESCRIPTION_TEMPLATE = Template(
    """\
Run a shell command in a bashkit virtual filesystem.
Runs inside an in-memory bashkit shell, not a host machine or container.
Write scratch files under /home/user/workspace (the working directory).
{% if network_enabled -%}
curl is available for HTTP(S) requests.
{%- else -%}
General-purpose network access is disabled; curl/wget and remote installs do not work.
{%- endif %}
Built-in bashkit commands (cat, grep, sed, awk, sort, jq, sqlite3, etc.) are available; \
do not assume host binaries like python, node, git, uv, or apt exist.
phoenix-gql is available for read-only GraphQL against the Phoenix schema (executed \
in-process, not over the network). Run `phoenix-gql --help` for usage. Pipe its JSON \
output through jq to extract what you need, e.g. \
`phoenix-gql '{ projects { edges { node { name } } } }' --data-only | jq '.data'`.\
"""
)


def _new_filesystem() -> FileSeed:
    """Seed files for a fresh sandbox: just the scratch workspace.

    bashkit takes initial files as a ``{path: contents}`` mapping (creating parent
    directories as needed), so a single placeholder file is enough to materialize
    the workspace directory the tool ``cd``s into.
    """

    return {f"{WORKSPACE_ROOT}/.keep": ""}


class _BashkitRuntime:
    """Thin adapter giving a :class:`bashkit.Bash` the ``exec`` surface this tool uses.

    bashkit resets shell state (including the working directory) between
    ``execute`` calls but keeps the filesystem, so each command is prefixed with a
    ``cd`` into the workspace to mirror the old persistent ``cwd`` behavior.
    """

    def __init__(self, bash: "bashkit.Bash") -> None:
        self._bash = bash

    async def exec(self, command: str) -> "bashkit.ExecResult":
        script = f"cd {WORKSPACE_ROOT}\n{command}"
        return await self._bash.execute(script)


def _build_runtime(
    *,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    filesystem: FileSeed,
    network_enabled: bool = False,
) -> _BashkitRuntime:
    """Construct a bashkit runtime around ``filesystem`` with ``phoenix-gql``."""
    from phoenix.server.agents.capabilities.tools.internal.phoenix_gql_command import (
        PhoenixGqlCommand,
    )

    phoenix_gql = PhoenixGqlCommand(
        schema=schema,
        build_graphql_context=build_graphql_context,
    )
    bash = bashkit.Bash(
        files=filesystem,
        custom_builtins={phoenix_gql.name: phoenix_gql},
        # bashkit's network is allowlist/allow-all based; ``None`` leaves
        # ``curl``/``wget`` unavailable (the networkless default).
        network={"allow_all": True} if network_enabled else None,
        sqlite=True,
        python=False,
        timeout_seconds=EXEC_TIMEOUT_SECONDS,
    )
    return _BashkitRuntime(bash)


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
    sub-agent invocation. Pass ``filesystem`` to seed extra files (e.g. tests).
    """

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
        filesystem: Optional[FileSeed] = None,
        network_enabled: bool = False,
    ) -> None:
        runtime = _build_runtime(
            schema=schema,
            build_graphql_context=build_graphql_context,
            filesystem=filesystem if filesystem is not None else _new_filesystem(),
            network_enabled=network_enabled,
        )
        description = _DESCRIPTION_TEMPLATE.render(network_enabled=network_enabled)

        async def bash(command: str, summary: str) -> str:
            result = await runtime.exec(command)
            return _format_result(result.stdout, result.stderr, result.exit_code)

        super().__init__(tools=[Tool(bash, takes_ctx=False, description=description)])


@dataclass
class BashCapability(AbstractStaticCapability[None]):
    """Capability that adds the networkless ``bash`` tool to an agent.

    Each agent build gets its own virtual filesystem (see :class:`BashToolset`).
    """

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str
    network_enabled: bool = False

    def get_toolset(self) -> AgentToolset[None] | None:
        return BashToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
            network_enabled=self.network_enabled,
        )

    def get_static_instructions(self) -> str:
        return self.instructions


__all__ = ["BashCapability", "BashToolset"]
