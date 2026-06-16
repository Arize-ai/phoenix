"""A ``phoenix-gql`` command for the bashkit sandbox.

This is the server-side counterpart of the browser tool's ``phoenix-gql`` command
(``app/src/agent/tools/bash/phoenixGqlCommand.ts``). It mirrors that CLI surface
but executes queries *networklessly* against the Strawberry schema (calling
``schema.execute`` directly) instead of issuing an HTTP request, so the bash
agent can run GraphQL and pipe the JSON result through ``jq`` and friends.

It is wired into the sandbox as a `bashkit <https://pypi.org/project/bashkit/>`_
*custom builtin*: a plain async callable that bashkit invokes on the host event
loop, which is what lets it ``await schema.execute(...)`` against the live
(async) Strawberry context in-process. See :mod:`bashkit` and the
``custom_builtins`` argument of :class:`bashkit.Bash`.
"""

from __future__ import annotations

import json
import posixpath
import re
from typing import TYPE_CHECKING, Any, Callable, Optional

import bashkit
import strawberry
from strawberry.schema.exceptions import InvalidOperationTypeError
from strawberry.types.graphql import OperationType

from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from bashkit import BuiltinContext

#: Scratch directory the sandbox can write to (mirrors the browser tool).
WORKSPACE_ROOT = "/home/user/workspace"

#: Serialized responses larger than this spill to a workspace file instead of
#: flooding stdout (and the agent's context window). ``--stdout`` overrides it.
DEFAULT_SPILL_THRESHOLD_BYTES = 128 * 1024

_HELP_TEXT = """\
Usage: phoenix-gql [query] [options] [query-or-file]

Execute read-only GraphQL operations against Phoenix (networkless, in-process).

Permissions: queries only (mutations and subscriptions are disabled).

Recommended flow:
  1. Run a tiny introspection query to confirm the schema before guessing fields:
     phoenix-gql '{ __schema { queryType { fields { name } } } }' --data-only | jq
  2. Build the real query incrementally, piping through jq to inspect the shape.

Options:
  --vars <json>         JSON object of GraphQL variables
  --variables <json>    Alias for --vars
  --vars-file <path>    Read GraphQL variables from a file
  --output <path>       Write the JSON response to a file instead of stdout
  --data-only           Print only the .data payload
  --stdout              Disable automatic spill-to-file for large responses
  --help                Show this help text

Examples:
  phoenix-gql '{ projects { edges { node { name } } } }'
  cat query.graphql | phoenix-gql --vars '{"id":"abc"}'
  phoenix-gql query.graphql --vars-file vars.json | jq '.data'
"""

_SUBSCRIPTION_RE = re.compile(r"^\s*subscription[\s({]", re.MULTILINE)
_NON_QUERY_RE = re.compile(r"^\s*(mutation|subscription)[\s({]", re.MULTILINE)


class _Usage(Exception):
    """Raised to short-circuit with a user-facing message and exit code."""

    def __init__(self, message: str, exit_code: int = 1) -> None:
        super().__init__(message)
        self.message = message
        self.exit_code = exit_code


def _strip_graphql_comments(query: str) -> str:
    return re.sub(r"#[^\n]*", "", query)


def _resolve_path(cwd: str, path: str) -> str:
    """Resolve ``path`` against ``cwd`` the way the sandbox shell would."""

    return posixpath.normpath(posixpath.join(cwd, path))


class PhoenixGqlCommand:
    """A bashkit custom builtin exposing networkless GraphQL execution.

    bashkit treats any callable in ``custom_builtins`` as a command, invoking it
    with a single :class:`bashkit.BuiltinContext` (whose ``argv`` excludes the
    command name) and expecting a :class:`bashkit.BuiltinResult` back. Because
    bashkit awaits async builtins on the host's running event loop, ``__call__``
    can ``await self._schema.execute(...)`` directly against the live async
    context.
    """

    name = "phoenix-gql"

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
    ) -> None:
        self._schema = schema
        self._build_graphql_context = build_graphql_context
        # Monotonic counter for deterministic spill filenames within a session.
        self._spill_counter = 0

    async def __call__(self, ctx: "BuiltinContext") -> "bashkit.BuiltinResult":
        try:
            parsed = _parse_args(list(ctx.argv))
        except _Usage as usage:
            return bashkit.BuiltinResult(
                stdout="", stderr=f"phoenix-gql: {usage.message}\n", exit_code=usage.exit_code
            )

        if parsed["show_help"]:
            return bashkit.BuiltinResult(stdout=_HELP_TEXT, stderr="", exit_code=0)

        try:
            query = _resolve_query_text(parsed["query_source"], ctx)
            self._reject_unsupported_operations(query)
            variable_values = _resolve_variables(parsed, ctx)
            result = await self._schema.execute(
                query,
                variable_values=variable_values,
                context_value=self._build_graphql_context(),
                allowed_operation_types={OperationType.QUERY},
            )
        except InvalidOperationTypeError:
            return bashkit.BuiltinResult(
                stdout="",
                stderr=(
                    "phoenix-gql: this command is read-only; only `query` operations are "
                    "permitted (mutations and subscriptions are disabled)\n"
                ),
                exit_code=1,
            )
        except _Usage as usage:
            return bashkit.BuiltinResult(
                stdout="", stderr=f"phoenix-gql: {usage.message}\n", exit_code=usage.exit_code
            )

        formatted_errors = [error.formatted for error in result.errors] if result.errors else []
        has_only_errors = bool(formatted_errors) and result.data is None

        payload: Any = result.data if parsed["data_only"] else {"data": result.data}
        if formatted_errors and not parsed["data_only"]:
            payload["errors"] = formatted_errors
        serialized = json.dumps(payload, indent=2, default=str) + "\n"

        error_notice = ""
        if formatted_errors:
            messages = "\n".join(f"- {error.get('message', error)}" for error in formatted_errors)
            error_notice = f"GraphQL errors:\n{messages}\n"

        if parsed["output_path"] is not None:
            written = _write_output(serialized, parsed["output_path"], ctx)
            stderr = error_notice + f"Response written to {written}\n" if error_notice else ""
            return bashkit.BuiltinResult(
                stdout=f"{written}\n",
                stderr=stderr,
                exit_code=1 if has_only_errors else 0,
            )

        if not parsed["force_stdout"] and len(serialized.encode("utf-8")) > (
            DEFAULT_SPILL_THRESHOLD_BYTES
        ):
            spill_path = self._next_spill_path()
            _write_output(serialized, spill_path, ctx)
            summary = json.dumps(
                {"spilled": True, "path": spill_path, "bytes": len(serialized.encode("utf-8"))},
                indent=2,
            )
            return bashkit.BuiltinResult(
                stdout=f"{summary}\n",
                stderr=(
                    "Response exceeded the stdout budget and was written to a workspace file. "
                    "Re-run with --stdout to force raw output.\n"
                ),
                exit_code=0,
            )

        return bashkit.BuiltinResult(
            stdout=serialized,
            stderr=error_notice,
            exit_code=1 if has_only_errors else 0,
        )

    def _reject_unsupported_operations(self, query: str) -> None:
        stripped = _strip_graphql_comments(query)
        if _SUBSCRIPTION_RE.search(stripped):
            raise _Usage("subscriptions are not supported by phoenix-gql")
        if _NON_QUERY_RE.search(stripped):
            raise _Usage(
                "this command is read-only; mutations are disabled (queries only)",
            )

    def _next_spill_path(self) -> str:
        self._spill_counter += 1
        return f"{WORKSPACE_ROOT}/phoenix-gql-result-{self._spill_counter}.json"


def _parse_args(args: list[str]) -> dict[str, Any]:
    # `phoenix-gql query ...` is accepted as a no-op subcommand prefix, and
    # `--variables` is an alias for `--vars`, matching the browser command.
    if args and args[0] == "query":
        args = args[1:]
    args = ["--vars" if arg == "--variables" else arg for arg in args]

    parsed: dict[str, Any] = {
        "query_source": None,
        "variables_text": None,
        "variables_file_path": None,
        "output_path": None,
        "data_only": False,
        "force_stdout": False,
        "show_help": False,
    }

    index = 0
    while index < len(args):
        arg = args[index]
        if arg == "--help":
            parsed["show_help"] = True
        elif arg == "--data-only":
            parsed["data_only"] = True
        elif arg == "--stdout":
            parsed["force_stdout"] = True
        elif arg in ("--vars", "--vars-file", "--output"):
            value = args[index + 1] if index + 1 < len(args) else None
            if value is None:
                raise _Usage(f"option {arg} requires a value")
            index += 1
            if arg == "--vars":
                parsed["variables_text"] = value
            elif arg == "--vars-file":
                parsed["variables_file_path"] = value
            else:
                parsed["output_path"] = value
        elif arg.startswith("--"):
            raise _Usage(f"unknown option: {arg}")
        elif parsed["query_source"] is not None:
            raise _Usage("expected a single query string or query file path")
        else:
            parsed["query_source"] = arg
        index += 1

    return parsed


def _resolve_query_text(query_source: Optional[str], ctx: "BuiltinContext") -> str:
    if query_source:
        resolved = _resolve_path(ctx.cwd, query_source)
        if ctx.fs.exists(resolved):
            return ctx.fs.read_file(resolved).decode("utf-8")
        return query_source

    # bashkit types pipeline stdin as ``str | None``; treat absent input as empty.
    piped = (ctx.stdin or "").strip()
    if not piped:
        raise _Usage("provide a GraphQL query string, file path, or stdin")
    return piped


def _resolve_variables(parsed: dict[str, Any], ctx: "BuiltinContext") -> Optional[dict[str, Any]]:
    if parsed["variables_file_path"]:
        resolved = _resolve_path(ctx.cwd, parsed["variables_file_path"])
        text: Optional[str] = ctx.fs.read_file(resolved).decode("utf-8")
    else:
        text = parsed["variables_text"]

    if not text:
        return None

    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise _Usage(f"could not parse GraphQL variables as JSON: {error}")
    if not isinstance(value, dict):
        raise _Usage("GraphQL variables must be a JSON object")
    return value


def _write_output(content: str, path: str, ctx: "BuiltinContext") -> str:
    resolved = _resolve_path(ctx.cwd, path)
    parent = resolved.rsplit("/", 1)[0] or "/"
    if not ctx.fs.exists(parent):
        ctx.fs.mkdir(parent, recursive=True)
    # bashkit's virtual filesystem stores bytes; encode before writing.
    ctx.fs.write_file(resolved, content.encode("utf-8"))
    return resolved
