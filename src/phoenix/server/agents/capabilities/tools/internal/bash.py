from __future__ import annotations

import json
import posixpath
import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Optional

import strawberry
from bashkit import Bash, BuiltinContext, BuiltinResult
from jinja2 import Template
from pydantic_ai import Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset
from strawberry.types.graphql import OperationType

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    # NetworkConfig is a TypedDict that only exists in bashkit's type stubs, not at
    # runtime, so it is imported for annotations only.
    from bashkit._bashkit import NetworkConfig

# Scratch space for command output, mirroring the just-bash frontend bash runtime.
WORKSPACE_ROOT = "/home/user/workspace"

# Responses larger than this are written to a workspace file instead of stdout, so a
# single large GraphQL payload cannot blow the model's context budget. Mirrors the
# frontend ``phoenix-gql`` command.
DEFAULT_SPILL_THRESHOLD_BYTES = 128 * 1024

_BASH_TOOL_DESCRIPTION_TEMPLATE = Template(
    """\
Run a shell command inside a server-side virtual shell to run built-in utilities and \
operate on a scratch filesystem.

- Runs inside an in-process virtual shell, not a host machine or container.
- Write scratch files only under /home/user/workspace.
{% if enable_web_access -%}
- Network access is enabled: the curl, wget, and http built-ins may reach external \
URLs, though remote package installs should still not be assumed to work.
{% else -%}
- General-purpose network access is disabled, so curl/wget and remote package installs \
should not be assumed to work.
{% endif -%}
- Built-in shell commands are available; do not assume apt, brew, pnpm, uv, git, or \
other host binaries exist.
- Language runtimes such as python, python3, and node are not available.
- phoenix-gql is available for GraphQL operations against the Phoenix GraphQL API. \
Run `phoenix-gql --help` for usage and current permissions.

Args:
    command: The shell command to execute.

Returns a dict with the command's `stdout`, `stderr`, and `exit_code`.
""",
    trim_blocks=True,
    lstrip_blocks=True,
)


def _strip_graphql_comments(query: str) -> str:
    return re.sub(r"#[^\n]*", "", query)


def _is_non_query_operation(query: str) -> bool:
    stripped = _strip_graphql_comments(query)
    return re.search(r"^\s*(mutation|subscription)[\s({]", stripped, re.MULTILINE) is not None


def _is_subscription_operation(query: str) -> bool:
    stripped = _strip_graphql_comments(query)
    return re.search(r"^\s*subscription[\s({]", stripped, re.MULTILINE) is not None


def _byte_length(content: str) -> int:
    return len(content.encode("utf-8"))


def _resolve_path(cwd: str, path: str) -> str:
    """Resolve ``path`` against ``cwd`` the way the frontend ``fs.resolvePath`` does."""
    if path.startswith("/"):
        return posixpath.normpath(path)
    return posixpath.normpath(posixpath.join(cwd, path))


def _format_graphql_errors(messages: list[str]) -> str:
    formatted = "\n".join(f"- {message}" for message in messages)
    return f"GraphQL errors:\n{formatted}\n"


def _get_help_text(mutations_enabled: bool) -> str:
    permissions_line = (
        "Permissions: queries and mutations are ENABLED."
        if mutations_enabled
        else "Permissions: queries only (mutations are disabled)."
    )
    return f"""Usage: phoenix-gql [query] [options] [query-or-file]

Execute GraphQL operations against Phoenix.

{permissions_line}

Recommended flow:
  1. start with a tiny query or an introspection query to confirm the schema
  2. add filters, sorting, and deeper fields only after the base query works

Options:
  --vars <json>         JSON object of GraphQL variables
  --variables <json>    Alias for --vars
  --vars-file <path>    Read GraphQL variables from a file
  --output <path>       Write JSON response to a file instead of stdout
  --data-only           Print only the .data payload
  --stdout              Disable automatic spill-to-file for large responses
  --help                Show this help text

Examples:
  phoenix-gql '{{ projects {{ edges {{ node {{ name }} }} }} }}'
  cat query.graphql | phoenix-gql --vars '{{"id":"abc"}}'
  phoenix-gql query.graphql --vars-file vars.json | jq '.data'
"""


@dataclass
class _ParsedArgs:
    query_source: Optional[str]
    variables_text: Optional[str]
    variables_file_path: Optional[str]
    output_path: Optional[str]
    data_only: bool
    force_stdout: bool
    show_help: bool


def _normalize_args(args: list[str]) -> list[str]:
    if args and args[0] == "query":
        args = args[1:]
    return ["--vars" if arg == "--variables" else arg for arg in args]


def _parse_args(args: list[str]) -> _ParsedArgs:
    args = _normalize_args(args)
    query_source: Optional[str] = None
    variables_text: Optional[str] = None
    variables_file_path: Optional[str] = None
    output_path: Optional[str] = None
    data_only = False
    force_stdout = False
    show_help = False

    index = 0
    while index < len(args):
        arg = args[index]
        if arg == "--help":
            show_help = True
        elif arg == "--data-only":
            data_only = True
        elif arg == "--stdout":
            force_stdout = True
        elif arg == "--vars":
            variables_text = args[index + 1] if index + 1 < len(args) else None
            index += 1
        elif arg == "--vars-file":
            variables_file_path = args[index + 1] if index + 1 < len(args) else None
            index += 1
        elif arg == "--output":
            output_path = args[index + 1] if index + 1 < len(args) else None
            index += 1
        elif arg.startswith("--"):
            raise ValueError(f"Unknown option: {arg}")
        elif query_source is not None:
            raise ValueError("Expected a single query string or query file path")
        else:
            query_source = arg
        index += 1

    return _ParsedArgs(
        query_source=query_source,
        variables_text=variables_text,
        variables_file_path=variables_file_path,
        output_path=output_path,
        data_only=data_only,
        force_stdout=force_stdout,
        show_help=show_help,
    )


def _resolve_query_text(parsed: _ParsedArgs, ctx: BuiltinContext) -> str:
    if parsed.query_source:
        resolved_path = _resolve_path(ctx.cwd, parsed.query_source)
        if ctx.fs.exists(resolved_path):
            return ctx.fs.read_file(resolved_path).decode("utf-8")
        return parsed.query_source

    piped_query = (ctx.stdin or "").strip()
    if not piped_query:
        raise ValueError("Provide a GraphQL query string, file path, or stdin")
    return piped_query


def _resolve_variables(parsed: _ParsedArgs, ctx: BuiltinContext) -> Optional[dict[str, Any]]:
    if parsed.variables_file_path:
        resolved = _resolve_path(ctx.cwd, parsed.variables_file_path)
        variables_text: Optional[str] = ctx.fs.read_file(resolved).decode("utf-8")
    else:
        variables_text = parsed.variables_text

    if not variables_text:
        return None

    parsed_variables = json.loads(variables_text)
    if not isinstance(parsed_variables, dict):
        raise ValueError("GraphQL variables must be a JSON object")
    return parsed_variables


def _get_automatic_spill_path() -> str:
    return f"{WORKSPACE_ROOT}/phoenix-gql-result-{int(time.time() * 1000)}.json"


def _write_file(ctx: BuiltinContext, path: str, content: str) -> None:
    parent = path[: path.rfind("/")] or "/"
    if not ctx.fs.exists(parent):
        ctx.fs.mkdir(parent, True)
    ctx.fs.write_file(path, content.encode("utf-8"))


def create_phoenix_gql_builtin(
    *,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    allow_mutations: bool,
) -> Callable[[BuiltinContext], Any]:
    """Build the ``phoenix-gql`` custom shell command.

    Behavior mirrors the frontend just-bash ``phoenix-gql`` command, except the query is
    executed directly against the in-process GraphQL ``schema`` rather than over the
    network.
    """
    allowed_operation_types = (
        {OperationType.QUERY, OperationType.MUTATION} if allow_mutations else {OperationType.QUERY}
    )

    async def phoenix_gql(ctx: BuiltinContext) -> BuiltinResult:
        try:
            parsed = _parse_args(list(ctx.argv))

            if parsed.show_help:
                return BuiltinResult(stdout=_get_help_text(allow_mutations), stderr="", exit_code=0)

            query = _resolve_query_text(parsed, ctx)

            if _is_non_query_operation(query) and not allow_mutations:
                raise ValueError(
                    "Mutations are not currently permitted. "
                    "The user can enable the 'Dangerously enable mutations' agent "
                    "capability from the debug menu."
                )

            if _is_subscription_operation(query):
                raise ValueError("Subscriptions are not supported by phoenix-gql")

            variables = _resolve_variables(parsed, ctx)

            result = await schema.execute(
                query,
                variable_values=variables,
                context_value=build_graphql_context(),
                allowed_operation_types=allowed_operation_types,
            )

            permissions_notice = (
                "[permissions: queries + mutations]\n"
                if allow_mutations
                else "[permissions: queries only]\n"
            )

            errors = list(result.errors or [])
            payload: dict[str, Any] = {"data": result.data}
            if errors:
                payload["errors"] = [error.formatted for error in errors]
            graphql_error_text = (
                _format_graphql_errors([error.message for error in errors]) if errors else ""
            )
            has_only_errors = bool(errors) and result.data is None

            output_payload: Any = result.data if parsed.data_only else payload
            serialized_output = json.dumps(output_payload, indent=2, ensure_ascii=False) + "\n"

            if parsed.output_path:
                output_path = _resolve_path(ctx.cwd, parsed.output_path)
                _write_file(ctx, output_path, serialized_output)
                return BuiltinResult(
                    stdout=f"{output_path}\n",
                    stderr=(
                        f"{permissions_notice}{graphql_error_text}"
                        f"Response written to {output_path}\n"
                        if errors
                        else permissions_notice
                    ),
                    exit_code=1 if has_only_errors else 0,
                )

            if (
                not parsed.force_stdout
                and _byte_length(serialized_output) > DEFAULT_SPILL_THRESHOLD_BYTES
            ):
                spill_path = _get_automatic_spill_path()
                _write_file(ctx, spill_path, serialized_output)
                return BuiltinResult(
                    stdout=json.dumps(
                        {
                            "spilled": True,
                            "path": spill_path,
                            "bytes": _byte_length(serialized_output),
                        },
                        indent=2,
                    )
                    + "\n",
                    stderr=(
                        f"{permissions_notice}Response exceeded stdout budget and was "
                        "written to a workspace file. Re-run with --stdout to force raw "
                        "output.\n"
                    ),
                    exit_code=0,
                )

            return BuiltinResult(
                stdout=serialized_output,
                stderr=f"{permissions_notice}{graphql_error_text}",
                exit_code=1 if has_only_errors else 0,
            )
        except Exception as error:
            return BuiltinResult(stdout="", stderr=f"{error}\n", exit_code=1)

    return phoenix_gql


class BashToolset(FunctionToolset[None]):
    """Toolset exposing a server-side ``bash`` tool backed by an in-process virtual shell.

    The shell carries a custom ``phoenix-gql`` command whose behavior mirrors the
    just-bash frontend command, executing GraphQL against the in-process ``schema``.
    """

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
        allow_mutations: bool,
        enable_web_access: bool = False,
    ) -> None:
        # When web access is toggled on, allow network built-ins (curl, wget, http) to
        # reach external URLs, keeping the SSRF guard against private IPs in place.
        network: NetworkConfig | None = None
        if enable_web_access:
            network = {"allow_all": True, "block_private_ips": True}
        shell = Bash(
            python=False,
            network=network,
            custom_builtins={
                "phoenix-gql": create_phoenix_gql_builtin(
                    schema=schema,
                    build_graphql_context=build_graphql_context,
                    allow_mutations=allow_mutations,
                ),
            },
        )

        async def bash(command: str) -> dict[str, Any]:
            result = await shell.execute(command)
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }

        super().__init__(
            tools=[
                Tool(
                    bash,
                    takes_ctx=False,
                    description=_BASH_TOOL_DESCRIPTION_TEMPLATE.render(
                        enable_web_access=enable_web_access
                    ),
                )
            ]
        )


@dataclass
class BashCapability(AbstractStaticCapability[None]):
    """Capability that adds the server-side ``bash`` tool (with ``phoenix-gql``) to an agent."""

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str
    allow_mutations: bool = False
    enable_web_access: bool = False

    def get_toolset(self) -> AgentToolset[None] | None:
        return BashToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
            allow_mutations=self.allow_mutations,
            enable_web_access=self.enable_web_access,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
