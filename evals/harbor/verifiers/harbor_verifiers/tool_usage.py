"""Diagnostics from an ATIF trajectory: which Phoenix surfaces the agent reached.

Every value is numeric so it rides along in ``reward.json`` as its own evaluation
beside ``reward``. None of them changes the pass or fail verdict. Tokens, cost, and
latency are not repeated here: the plugin's trace carries them per LLM span.

Agents reach Phoenix three ways and name their tools differently, so classification
works on the tool name after any ``mcp__<server>__`` prefix, then on the arguments:

- SQL: the ``executeSql`` and ``describeSqlSchema`` tools, called directly or from
  code-mode ``execute`` via ``call_tool``.
- GraphQL: PXI's ``phoenix-gql`` shell builtin, the px CLI's ``px api graphql``, or a
  request to ``/graphql`` from a shell.
- REST: any other ``/v1`` tool, which the MCP server and PXI generate from the OpenAPI
  spec with camelCase operation ids; any other ``call_tool`` target in code mode; or a
  shell command that runs the px CLI or requests ``/v1/``.

Codex can also run its tools from a JavaScript ``exec`` script, where each MCP tool is
a function on ``tools`` such as ``tools.mcp__phoenix__execute(...)``. Every tool the
script references is classified as if it had been called directly with the script as
its arguments.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from harbor_verifiers.verify import agent_steps

SQL_TOOLS = frozenset({"executesql", "describesqlschema"})
CODE_MODE_TOOLS = frozenset({"execute"})
META_TOOLS = frozenset({"list_tools", "get_schema", "search", "tags", "toolsearch"})
SHELL_TOOLS = frozenset(
    {"bash", "shell", "sh", "run_terminal_cmd", "terminal", "execute_command", "exec_command"}
)
# Codex's JavaScript tool-calling mode: one script that calls `tools.<name>(...)`.
SCRIPT_TOOLS = frozenset({"exec"})

_SERVER_PREFIX = re.compile(r"^mcp__[^_]+(?:_[^_]+)*?__")
_CALL_TOOL = re.compile(r"""call_tool\(\s*['"]([A-Za-z0-9_]+)['"]""")
_SCRIPT_TOOL = re.compile(r"\btools\.([A-Za-z0-9_]+)\s*\(")
# Each group's tail excludes capitals so a run of them cannot be split two ways,
# which would let the matcher backtrack exponentially on long names.
_CAMEL_CASE = re.compile(r"^[a-z]+(?:[A-Z][a-z0-9]*)+$")
# A path counts as a request to Phoenix only right after a local host, a shell
# variable, or a bare port, so neither a grep over the installed routers/v1 package
# nor a call to another vendor's /v1 API is a REST call.
_URL = (
    r"(?:https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)(?::\d+)?"
    r"|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|:\d{2,5})"
)
_GRAPHQL = re.compile(rf"phoenix-gql|phoenix_gql|\bpx\s+api\s+graphql\b|{_URL}/graphql\b")
# The px CLI counts only at the start of a command segment, not inside quoted text.
_REST_SHELL = re.compile(rf"{_URL}/v1/|(?:^|[;&|(])\s*px\s+(?!api\s+graphql)[a-z]", re.MULTILINE)
_SQL_SHELL = re.compile(r"executeSql|describeSqlSchema")

Category = str  # "sql", "graphql", or "rest"


def base_name(function_name: str) -> str:
    """The tool name without the MCP server prefix that clients prepend."""
    return _SERVER_PREFIX.sub("", function_name)


def _strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _arguments_text(call: dict[str, Any]) -> str:
    """The raw strings in the arguments, so shell commands and code are matched as
    written rather than through JSON escaping."""
    return "\n".join(_strings(call.get("arguments")))


def categories(call: dict[str, Any]) -> set[Category]:
    """The Phoenix surfaces one tool call reaches; empty for anything else."""
    function_name = str(call.get("function_name") or call.get("name") or "")
    name = base_name(function_name)
    lowered = name.lower()
    if lowered in SQL_TOOLS:
        return {"sql"}
    if lowered in META_TOOLS:
        return set()
    text = _arguments_text(call)
    found: set[Category] = set()
    if lowered in SCRIPT_TOOLS:
        for referenced in _SCRIPT_TOOL.findall(text):
            found |= categories({"function_name": referenced, "arguments": text})
        return found
    if lowered in CODE_MODE_TOOLS:
        for target in _CALL_TOOL.findall(text):
            if target.lower() in SQL_TOOLS:
                found.add("sql")
            elif target.lower() not in META_TOOLS:
                found.add("rest")
        return found
    if lowered in SHELL_TOOLS:
        if _SQL_SHELL.search(text):
            found.add("sql")
        if _GRAPHQL.search(text):
            found.add("graphql")
        if _REST_SHELL.search(text):
            found.add("rest")
        return found
    if "gql" in lowered or "graphql" in lowered:
        return {"graphql"}
    if _CAMEL_CASE.match(name):
        return {"rest"}
    return set()


def tool_calls(trajectory: dict[str, Any] | None) -> Iterable[dict[str, Any]]:
    for step in agent_steps(trajectory):
        for call in step.get("tool_calls") or []:
            if isinstance(call, dict):
                yield call


def surface_usage(trajectory: dict[str, Any] | None) -> dict[str, float]:
    """Per surface, whether it was used and how many calls reached it."""
    counts = {"sql": 0, "graphql": 0, "rest": 0}
    for call in tool_calls(trajectory):
        for category in categories(call):
            counts[category] += 1
    usage: dict[str, float] = {}
    for category, count in counts.items():
        usage[f"used_{category}"] = 1.0 if count else 0.0
        usage[f"{category}_call_count"] = float(count)
    return usage
