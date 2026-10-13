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

# Skills that describe how to reach Phoenix. Whether an agent loads one depends on the
# agent's tools, not on the task, so ``"skills_not_loaded": "any"`` allows them.
INTERFACE_SKILLS = frozenset({"phoenix-cli", "phoenix-graphql", "phoenix-tracing"})


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


def loaded_skills(trajectory: dict[str, Any] | None) -> list[str]:
    """Returns the names of the skills the agent loaded, in first-load order."""
    loaded: dict[str, None] = {}
    for step in agent_steps(trajectory):
        for tool_call in step.get("tool_calls") or []:
            if isinstance(tool_call, dict):
                loaded.update(dict.fromkeys(_skills_in_call(tool_call)))
    return list(loaded)


def skill_scores(loaded: list[str], expected: dict[str, Any]) -> dict[str, float]:
    """Scores the loaded skills against a task's ``expected.json``.

    ``skills_loaded`` is a list of skills the agent must load. It produces ``skill_loaded``.

    ``skills_not_loaded`` produces ``skill_not_loaded``. It is a list of skills the agent
    must not load, or ``"any"`` to forbid every skill except those in ``skills_loaded``
    and :data:`INTERFACE_SKILLS`.

    Each score is 1.0 on a pass and 0.0 otherwise. A key that ``expected`` omits produces
    no score.
    """
    scores: dict[str, float] = {}
    required = set(expected.get("skills_loaded", []))
    if "skills_loaded" in expected:
        scores["skill_loaded"] = float(required <= set(loaded))
    if "skills_not_loaded" in expected:
        forbidden = expected["skills_not_loaded"]
        if forbidden == "any":
            wrong = set(loaded) - required - INTERFACE_SKILLS
        else:
            wrong = set(loaded) & set(forbidden)
        scores["skill_not_loaded"] = float(not wrong)
    return scores
