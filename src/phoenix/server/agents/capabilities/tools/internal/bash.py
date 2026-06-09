"""A networkless ``bash`` tool for the server agent.

Runs commands inside an in-memory just-bash virtual shell (no host access, no
network) and exposes a custom ``phoenix-gql`` binary that executes read-only
GraphQL against the Strawberry schema in-process. The agent can therefore run
GraphQL and pipe the JSON result through sandbox tools such as ``jq``.

The virtual filesystem is persisted per session via a ``BashFilesystemStore``
(a ``{session_id: InMemoryFs}`` map held on ``app.state``), so files written
under the workspace survive across conversation turns within a session. Only the
filesystem is reused across requests; a fresh ``Bash`` runtime — and a freshly
bound ``phoenix-gql`` (so it uses the current request's GraphQL context/auth) —
is built around it on each agent build.

just-bash requires Python >= 3.11. On older interpreters (Phoenix still supports
3.10) the package is absent; :func:`bash_tool_available` reports this so callers
can omit the capability instead of failing at agent-build time.
"""

from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Optional

import strawberry
from pydantic_ai import Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from just_bash import Bash, InMemoryFs

    #: Process-global, session-keyed store of virtual filesystems. Created once on
    #: ``app.state`` and shared across requests so each session keeps its files.
    BashFilesystemStore = dict[str, InMemoryFs]

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


def bash_tool_available() -> bool:
    """Whether the ``just-bash`` package is importable (requires Python >= 3.11)."""
    return importlib.util.find_spec("just_bash") is not None


def _new_session_filesystem() -> InMemoryFs:
    """Create a fresh in-memory filesystem seeded with the scratch workspace.

    Lazy ``just_bash`` import so this module loads without the package installed.
    """
    from just_bash import InMemoryFs

    return InMemoryFs(initial_files={f"{WORKSPACE_ROOT}/.keep": ""})


def get_or_create_session_filesystem(
    store: "BashFilesystemStore",
    session_id: str,
) -> InMemoryFs:
    """Return the session's filesystem, creating and registering it on first use.

    Reusing the same ``InMemoryFs`` across requests is what makes workspace files
    persist across conversation turns within a session.
    """
    fs = store.get(session_id)
    if fs is None:
        fs = _new_session_filesystem()
        store[session_id] = fs
    return fs


def _build_runtime(
    *,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    filesystem: InMemoryFs,
) -> Bash:
    """Construct a just-bash runtime around ``filesystem`` with ``phoenix-gql``.

    A new runtime is built per agent build, but it wraps the (possibly persisted)
    ``filesystem`` so workspace files carry over. Built lazily so this module
    imports cleanly without ``just-bash`` installed.
    """
    from just_bash import Bash
    from just_bash.commands.registry import create_command_registry

    from phoenix.server.agents.capabilities.tools.internal.phoenix_gql_command import (
        PhoenixGqlCommand,
    )

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

    The runtime is built once per toolset and reused across calls within an agent
    run. When ``filesystem`` is provided (the per-session ``InMemoryFs``), files
    also persist across runs/requests that share it; otherwise a fresh,
    transient filesystem is created for this toolset only.
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
            filesystem=filesystem if filesystem is not None else _new_session_filesystem(),
        )

        async def bash(command: str, summary: str) -> str:
            result = await runtime.exec(command)
            return _format_result(result.stdout, result.stderr, result.exit_code)

        super().__init__(tools=[Tool(bash, takes_ctx=False, description=DESCRIPTION)])


@dataclass
class BashCapability(AbstractStaticCapability[None]):
    """Capability that adds the networkless ``bash`` tool to an agent.

    When ``session_id`` and ``filesystem_store`` are both supplied, the tool's
    virtual filesystem is fetched from (or created in) the store, so it persists
    across conversation turns within that session. Otherwise each agent build
    gets a fresh, transient filesystem.
    """

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str
    session_id: Optional[str] = None
    filesystem_store: Optional["BashFilesystemStore"] = None

    def get_toolset(self) -> AgentToolset[None] | None:
        filesystem: Optional[InMemoryFs] = None
        if self.filesystem_store is not None and self.session_id is not None:
            filesystem = get_or_create_session_filesystem(self.filesystem_store, self.session_id)
        return BashToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
            filesystem=filesystem,
        )

    def get_static_instructions(self) -> str:
        return self.instructions


__all__ = [
    "BashCapability",
    "BashToolset",
    "bash_tool_available",
    "get_or_create_session_filesystem",
]
