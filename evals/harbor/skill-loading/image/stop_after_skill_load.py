"""Ends an agent's session at its first action that isn't a skill load.

A skill load is Claude Code's ``Skill`` tool, an MCP ``load_skill`` call, or a shell command
that reads a ``SKILL.md`` file. Any other action ends the session before it runs, so the
trajectory holds the skills the agent loaded first and nothing else.

Claude Code runs this file as a ``PreToolUse`` hook, with the tool call as JSON on stdin.
The ``codex`` wrapper in this image imports :func:`is_skill_load`, because Codex runs hooks
from its user config only after you trust them.
"""

import json
import sys


def is_skill_load(tool: str, arguments: str) -> bool:
    return tool == "Skill" or tool.endswith("load_skill") or "SKILL.md" in arguments


if __name__ == "__main__":
    event = json.load(sys.stdin)
    tool = str(event.get("tool_name") or "")
    if not is_skill_load(tool, json.dumps(event.get("tool_input") or {})):
        print(
            json.dumps(
                {"continue": False, "stopReason": "the agent did something besides loading a skill"}
            )
        )
