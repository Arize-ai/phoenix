"""A ``phoenix-gql`` command for the just-bash sandbox.

This is the server-side counterpart of the browser tool's ``phoenix-gql`` command
(``app/src/agent/tools/bash/phoenixGqlCommand.ts``). It mirrors that CLI surface
but executes queries *networklessly* against the Strawberry schema via
:func:`execute_networkless_query` instead of issuing an HTTP request, so the bash
agent can run GraphQL and pipe the JSON result through ``jq`` and friends.

Importing this module requires ``just-bash`` to be installed (Python >= 3.11).
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional

import strawberry
from just_bash.types import CommandContext, ExecResult
from strawberry.schema.exceptions import InvalidOperationTypeError

from phoenix.server.agents.capabilities.tools.internal.networkless_graphql import (
    execute_networkless_query,
)
from phoenix.server.api.context import Context

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


class PhoenixGqlCommand:
    """just-bash ``Command`` exposing networkless GraphQL execution as a binary.

    Conforms structurally to ``just_bash.types.Command`` (a ``name`` attribute and
    an async ``execute(args, ctx)`` returning an ``ExecResult``).
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

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        try:
            parsed = _parse_args(args)
        except _Usage as usage:
            return ExecResult(stderr=f"phoenix-gql: {usage.message}\n", exit_code=usage.exit_code)

        if parsed["show_help"]:
            return ExecResult(stdout=_HELP_TEXT)

        try:
            query = await _resolve_query_text(parsed["query_source"], ctx)
            self._reject_unsupported_operations(query)
            variable_values = await _resolve_variables(parsed, ctx)
            result = await execute_networkless_query(
                schema=self._schema,
                context=self._build_graphql_context(),
                query=query,
                variable_values=variable_values,
            )
        except InvalidOperationTypeError:
            return ExecResult(
                stderr=(
                    "phoenix-gql: this command is read-only; only `query` operations are "
                    "permitted (mutations and subscriptions are disabled)\n"
                ),
                exit_code=1,
            )
        except _Usage as usage:
            return ExecResult(stderr=f"phoenix-gql: {usage.message}\n", exit_code=usage.exit_code)

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
            written = await _write_output(serialized, parsed["output_path"], ctx)
            stderr = error_notice + f"Response written to {written}\n" if error_notice else ""
            return ExecResult(
                stdout=f"{written}\n",
                stderr=stderr,
                exit_code=1 if has_only_errors else 0,
            )

        if not parsed["force_stdout"] and len(serialized.encode("utf-8")) > (
            DEFAULT_SPILL_THRESHOLD_BYTES
        ):
            spill_path = self._next_spill_path()
            await _write_output(serialized, spill_path, ctx)
            summary = json.dumps(
                {"spilled": True, "path": spill_path, "bytes": len(serialized.encode("utf-8"))},
                indent=2,
            )
            return ExecResult(
                stdout=f"{summary}\n",
                stderr=(
                    "Response exceeded the stdout budget and was written to a workspace file. "
                    "Re-run with --stdout to force raw output.\n"
                ),
                exit_code=0,
            )

        return ExecResult(
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


async def _resolve_query_text(query_source: Optional[str], ctx: CommandContext) -> str:
    if query_source:
        resolved = ctx.fs.resolve_path(ctx.cwd, query_source)
        if await ctx.fs.exists(resolved):
            return await ctx.fs.read_file(resolved)
        return query_source

    piped = ctx.stdin.strip()
    if not piped:
        raise _Usage("provide a GraphQL query string, file path, or stdin")
    return piped


async def _resolve_variables(
    parsed: dict[str, Any], ctx: CommandContext
) -> Optional[dict[str, Any]]:
    if parsed["variables_file_path"]:
        resolved = ctx.fs.resolve_path(ctx.cwd, parsed["variables_file_path"])
        text: Optional[str] = await ctx.fs.read_file(resolved)
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


async def _write_output(content: str, path: str, ctx: CommandContext) -> str:
    resolved = ctx.fs.resolve_path(ctx.cwd, path)
    parent = resolved.rsplit("/", 1)[0] or "/"
    if not await ctx.fs.exists(parent):
        await ctx.fs.mkdir(parent, recursive=True)
    await ctx.fs.write_file(resolved, content)
    return resolved
