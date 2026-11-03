"""Picks the routing suites a change needs to rerun.

Routing is relative: rewording one skill's description can pull queries away from its
siblings. So when a description changes, every suite that shares a channel with that skill
reruns. Other triggers:

- A changed routing file reruns that skill's suite.
- A change to the runner or this workflow reruns every suite.
- A change to the MCP skill instructions reruns every suite on the ``mcp`` channel.

Prints ``{"skills": [...], "channels": [...]}`` as JSON. Empty lists mean nothing to run.

Usage: ``python -m evals.skills.runner.affected BASE_REF``
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Optional

import yaml

from evals.skills.runner.cases import REPO_ROOT, RoutingFile, routing_files

WORKFLOW = ".github/workflows/skill-routing-evals.yml"
MCP_INSTRUCTIONS = (
    "src/phoenix/server/mcp/skills/__init__.py",
    "src/phoenix/server/agents/prompts/skills/SKILLS_INSTRUCTIONS.xml.j2",
)


def _git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO_ROOT, text=True)


def _description(ref: Optional[str], path: str) -> Optional[str]:
    """Returns the frontmatter description of a SKILL.md at a ref, or in the worktree."""
    try:
        text = _git("show", f"{ref}:{path}") if ref else (REPO_ROOT / path).read_text()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    frontmatter = yaml.safe_load(parts[1])
    return str(frontmatter.get("description")) if isinstance(frontmatter, dict) else None


def affected(base: str, changed: list[str], files: list[RoutingFile]) -> dict[str, list[str]]:
    by_skill = {routing.skill: routing for routing in files}
    every_channel = sorted({c for routing in files for c in routing.resolved_channels()})
    if WORKFLOW in changed or any(path.startswith("evals/skills/runner/") for path in changed):
        return {"skills": sorted(by_skill), "channels": every_channel}

    skills: set[str] = set()
    channels: set[str] = set()
    for path in changed:
        parts = path.split("/")
        if path.startswith("evals/skills/") and path.endswith("/routing.yaml"):
            skill = parts[2]
            if skill in by_skill:
                skills.add(skill)
                channels.update(by_skill[skill].resolved_channels())
        elif len(parts) == 3 and parts[0] == "skills" and parts[2] == "SKILL.md":
            skill = parts[1]
            if _description(base, path) == _description(None, path):
                continue
            changed_channels = (
                set(by_skill[skill].resolved_channels()) if skill in by_skill else set()
            )
            changed_channels = changed_channels or set(every_channel)
            channels.update(changed_channels)
            skills.update(
                name
                for name, routing in by_skill.items()
                if changed_channels & set(routing.resolved_channels())
            )
        elif path in MCP_INSTRUCTIONS:
            channels.add("mcp")
            skills.update(n for n, r in by_skill.items() if "mcp" in r.resolved_channels())
    return {"skills": sorted(skills), "channels": sorted(channels)}


def main() -> None:
    base = sys.argv[1]
    changed = _git("diff", "--name-only", f"{base}...HEAD").split()
    print(json.dumps(affected(base, changed, routing_files())))


if __name__ == "__main__":
    main()
