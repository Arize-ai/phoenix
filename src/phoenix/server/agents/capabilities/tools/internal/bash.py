from __future__ import annotations

import json
import posixpath
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional

import strawberry
from bashkit import Bash, BuiltinContext, BuiltinResult
from graphql import GraphQLSyntaxError
from graphql import OperationType as GraphQLOperationType
from graphql import parse as parse_graphql
from graphql.language.ast import OperationDefinitionNode
from jinja2 import Template
from pydantic_ai import Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset
from strawberry.types.graphql import OperationType
from typing_extensions import TypedDict

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

WORKSPACE_ROOT = "/home/user/workspace"
TMP_ROOT = "/tmp"

_BASH_TOOL_DESCRIPTION_TEMPLATE = Template(
    """\
Run a shell command inside a server-side virtual shell to run built-in utilities and \
operate on a scratch filesystem.

- Runs inside an in-process virtual shell, not a host machine or container.
- Write scratch files only under /home/user/workspace.
- General-purpose network access is disabled, so curl/wget and remote package installs \
should not be assumed to work.
- Built-in shell commands are available; do not assume apt, brew, pnpm, uv, git, or \
other host binaries exist.
- Language runtimes such as python, python3, and node are not available.
- phoenix-gql is available for GraphQL operations against the Phoenix GraphQL API. \
Run `phoenix-gql --help` for usage and current permissions.

Args:
    summary: Short, user-facing description of what this command does. Shown as the
        collapsed preview in the UI.
    command: The shell command to execute.

Returns a dict with the command's `stdout`, `stderr`, and `exit_code`.
""",
)


def _operation_types(query: str) -> set[GraphQLOperationType]:
    """Return the set of GraphQL operation types declared in ``query``.

    Comments abutting the keyword and shorthand syntax defeat a naive regex, but the
    AST-based classifier handles them. Invalid syntax yields an empty set and is left
    for ``schema.execute`` to report.

    >>> _operation_types("mutation# do it later\\n{ deleteEverything }")
    {<OperationType.MUTATION: 'mutation'>}
    >>> _operation_types("# subscription example\\nquery { hello }")
    {<OperationType.QUERY: 'query'>}
    >>> _operation_types("subscription { hello }")
    {<OperationType.SUBSCRIPTION: 'subscription'>}
    >>> _operation_types("{ hello }")
    {<OperationType.QUERY: 'query'>}
    >>> _operation_types("this is not graphql !!")
    set()

    A document declaring several operations reports every type it contains (sorted here
    for a stable repr):

    >>> doc = "query A { hello }\\nmutation B { deleteEverything }"
    >>> sorted(op.value for op in _operation_types(doc))
    ['mutation', 'query']
    """
    try:
        document = parse_graphql(query)
    except GraphQLSyntaxError:
        return set()
    return {
        definition.operation
        for definition in document.definitions
        if isinstance(definition, OperationDefinitionNode)
    }


def _resolve_path(cwd: str, path: str) -> str:
    """Resolve ``path`` against ``cwd``.resolvePath`` does.

    Relative paths are joined onto ``cwd``; absolute paths ignore it. The result is
    normalized, collapsing ``.`` and ``..`` segments.

    >>> _resolve_path("/home/user/workspace", "out.json")
    '/home/user/workspace/out.json'
    >>> _resolve_path("/home/user/workspace", "/etc/passwd")
    '/etc/passwd'
    >>> _resolve_path("/home/user/workspace", "../shared/q.graphql")
    '/home/user/shared/q.graphql'
    """
    if path.startswith("/"):
        return posixpath.normpath(path)
    return posixpath.normpath(posixpath.join(cwd, path))


def _format_graphql_errors(messages: list[str]) -> str:
    formatted = "\n".join(f"- {message}" for message in messages)
    return f"GraphQL errors:\n{formatted}\n"


# Annotated because jinja2's `Template.__new__` returns `t.Any`, which would
# make the instance (and `.render()`) untyped under mypy.
_HELP_TEXT_TEMPLATE: Template = Template(
    """\
Usage: phoenix-gql [query] [options] [query-or-file]

Execute GraphQL operations against Phoenix.

{% if mutations_enabled -%}
Permissions: queries and mutations are ENABLED.
{% else -%}
Permissions: queries only (mutations are disabled).
{% endif %}
Recommended flow:
  1. start with a tiny query or an introspection query to confirm the schema
  2. add filters, sorting, and deeper fields only after the base query works

Options:
  --vars <json>         JSON object of GraphQL variables
  --variables <json>    Alias for --vars
  --vars-file <path>    Read GraphQL variables from a file
  --output <path>       Write JSON response to a file instead of stdout
  --data-only           Print only the .data payload
  --help                Show this help text

Examples:
  phoenix-gql '{ projects { edges { node { name } } } }'
  cat query.graphql | phoenix-gql --vars '{"id":"abc"}'
  phoenix-gql query.graphql --vars-file vars.json | jq '.data'
"""
)


def _get_help_text(mutations_enabled: bool) -> str:
    return _HELP_TEXT_TEMPLATE.render(mutations_enabled=mutations_enabled)


@dataclass
class _ParsedArgs:
    query_source: Optional[str]
    variables_text: Optional[str]
    variables_file_path: Optional[str]
    output_path: Optional[str]
    data_only: bool
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
    show_help = False

    index = 0
    while index < len(args):
        arg = args[index]
        if arg == "--help":
            show_help = True
        elif arg == "--data-only":
            data_only = True
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
        show_help=show_help,
    )


def _resolve_query_text(parsed: _ParsedArgs, ctx: BuiltinContext) -> str:
    """Return the GraphQL query text selected by ``parsed``.

    A ``query_source`` that resolves to an existing file under ``ctx.cwd`` is read
    from the filesystem; otherwise it is taken as a literal inline query. With no
    ``query_source``, the stripped piped stdin is used, and an empty stdin is an
    error.
    """
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


def _write_file(ctx: BuiltinContext, path: str, content: str) -> None:
    parent = path[: path.rfind("/")] or "/"
    if not ctx.fs.exists(parent):
        ctx.fs.mkdir(parent, recursive=True)
    ctx.fs.write_file(path, content.encode("utf-8"))


def create_phoenix_gql_builtin(
    *,
    schema: strawberry.Schema,
    build_graphql_context: Callable[[], Context],
    allow_mutations: bool,
) -> Callable[[BuiltinContext], Awaitable[BuiltinResult]]:
    """Build the ``phoenix-gql`` custom shell command."""
    allowed_operation_types = (
        {OperationType.QUERY, OperationType.MUTATION} if allow_mutations else {OperationType.QUERY}
    )

    async def phoenix_gql(ctx: BuiltinContext) -> BuiltinResult:
        try:
            parsed = _parse_args(list(ctx.argv))

            if parsed.show_help:
                return BuiltinResult(stdout=_get_help_text(allow_mutations), stderr="", exit_code=0)

            query = _resolve_query_text(parsed, ctx)

            operation_types = _operation_types(query)

            if GraphQLOperationType.SUBSCRIPTION in operation_types:
                raise ValueError("Subscriptions are not supported by phoenix-gql")

            if GraphQLOperationType.MUTATION in operation_types and not allow_mutations:
                raise ValueError("Mutations are not permitted.")

            variables = _resolve_variables(parsed, ctx)

            result = await schema.execute(
                query,
                variable_values=variables,
                context_value=build_graphql_context(),
                allowed_operation_types=allowed_operation_types,
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
                        f"{graphql_error_text}Response written to {output_path}\n" if errors else ""
                    ),
                    exit_code=1 if has_only_errors else 0,
                )

            return BuiltinResult(
                stdout=serialized_output,
                stderr=graphql_error_text,
                exit_code=1 if has_only_errors else 0,
            )
        except Exception as error:
            return BuiltinResult(stdout="", stderr=f"{error}\n", exit_code=1)

    return phoenix_gql


class BashToolResult(TypedDict):
    """Result returned by the ``bash`` tool."""

    stdout: str
    stderr: str
    exit_code: int
    stdout_truncated: bool
    stderr_truncated: bool


class BashToolset(FunctionToolset[None]):
    """Toolset exposing a ``bash`` tool backed by a virtual shell."""

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
        allow_mutations: bool,
    ) -> None:
        shell = Bash(
            python=False,
            network=None,  # network is disabled so curl/wget/http cannot reach the internet
            custom_builtins={
                "phoenix-gql": create_phoenix_gql_builtin(
                    schema=schema,
                    build_graphql_context=build_graphql_context,
                    allow_mutations=allow_mutations,
                ),
            },
        )
        shell.execute_sync_or_throw(f"mkdir -p {WORKSPACE_ROOT} {TMP_ROOT} && cd {WORKSPACE_ROOT}")

        async def bash(summary: str, command: str) -> BashToolResult:
            result = await shell.execute(command)
            result_dict = result.to_dict()
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
                "stdout_truncated": result_dict["stdout_truncated"],
                "stderr_truncated": result_dict["stderr_truncated"],
            }

        super().__init__(
            tools=[
                Tool(
                    bash,
                    takes_ctx=False,
                    description=_BASH_TOOL_DESCRIPTION_TEMPLATE.render(),
                )
            ]
        )


@dataclass
class BashCapability(AbstractStaticCapability[None]):
    """Capability that adds a ``bash`` toolset."""

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str
    allow_mutations: bool = False

    def get_toolset(self) -> AgentToolset[None] | None:
        return BashToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
            allow_mutations=self.allow_mutations,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
