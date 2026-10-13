"""Find which skills an agent loaded, from its ATIF trajectory.

Agents load a skill in one of three ways:

- Claude Code calls its ``Skill`` tool with a ``skill`` argument.
- PXI and the MCP clients call ``load_skill`` with a ``skill_name`` argument. MCP clients
  can prefix the tool name, for example ``mcp__phoenix__load_skill``.
- Codex has no skill tool for installed skills. It reads ``<skill>/SKILL.md`` with a shell
  command.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any

from harbor_verifiers.verify import agent_steps

_SKILL_FILE = re.compile(r"([\w.-]+)/SKILL\.md\b")


def _strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _skills_in_call(tool_call: dict[str, Any]) -> list[str]:
    name = str(tool_call.get("function_name") or "")
    arguments = tool_call.get("arguments")
    if not isinstance(arguments, dict):
        return []
    if name == "Skill":
        # A plugin skill is named ``<plugin>:<skill>``.
        return [str(arguments["skill"]).rpartition(":")[2]] if arguments.get("skill") else []
    if name.endswith("load_skill"):
        return [str(arguments["skill_name"])] if arguments.get("skill_name") else []
    return [match for text in _strings(arguments) for match in _SKILL_FILE.findall(text)]


def skills_loaded(trajectory: dict[str, Any] | None) -> list[str]:
    """Returns the names of the skills the agent loaded, in first-load order."""
    loaded: dict[str, None] = {}
    for step in agent_steps(trajectory):
        for tool_call in step.get("tool_calls") or []:
            if isinstance(tool_call, dict):
                loaded.update(dict.fromkeys(_skills_in_call(tool_call)))
    return list(loaded)


def skill_match(loaded: list[str], expected: dict[str, Any]) -> float | None:
    """Returns 1.0 if the agent loaded every ``skills_expected`` skill and no
    ``skills_unexpected`` skill, 0.0 otherwise, and None if ``expected`` names neither."""
    if "skills_expected" not in expected and "skills_unexpected" not in expected:
        return None
    wanted = set(expected.get("skills_expected", []))
    unwanted = set(expected.get("skills_unexpected", []))
    return float(wanted <= set(loaded) and unwanted.isdisjoint(loaded))
