"""Where the shipped skills live, and how the examples inside them are found.

Shared by the ``scripts/ci/test_skill_*_examples.py`` checks, which live outside ``tests/`` so
CI runs them only when a skill (or the artifact they validate against) changes.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml

from phoenix.server.mcp.skills import PXI_SKILLS_ROOT, SHARED_SKILLS_ROOT

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "js" / "app" / "schema.graphql"
AGENT_SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"
THIRD_PARTY_SKILLS_LOCKFILE = REPO_ROOT / "skills-lock.json"

_GRAPHQL_FENCE = re.compile(r"^[ \t]*```graphql[^\n]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
# A single-quoted query passed to the CLI, e.g. ``px api graphql '{ ... }'``. The body may
# contain the shell's escaped single quote, `'\''`.
_PX_API_GRAPHQL = re.compile(r"px api graphql '((?:[^']|'\\'')*)'")
_SHELL_ESCAPED_SINGLE_QUOTE = "'\\''"
_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---", re.DOTALL)


def _frontmatter(skill_dir: Path) -> dict[str, Any]:
    match = _FRONTMATTER.match((skill_dir / "SKILL.md").read_text(encoding="utf-8"))
    return yaml.safe_load(match.group(1)) if match else {}


def _is_internal(skill_dir: Path) -> bool:
    return bool(_frontmatter(skill_dir).get("metadata", {}).get("internal"))


def _skill_dirs(root: Path) -> list[Path]:
    return sorted(path for path in root.iterdir() if (path / "SKILL.md").is_file())


def public_agent_skill_dirs() -> list[Path]:
    """The ``.agents/skills`` entries Phoenix ships: not third-party, not internal."""
    third_party = json.loads(THIRD_PARTY_SKILLS_LOCKFILE.read_text(encoding="utf-8"))["skills"]
    return [
        skill_dir
        for skill_dir in _skill_dirs(AGENT_SKILLS_ROOT)
        if skill_dir.name not in third_party and not _is_internal(skill_dir)
    ]


def shipped_skill_dirs() -> list[Path]:
    return [
        *_skill_dirs(SHARED_SKILLS_ROOT),
        *_skill_dirs(PXI_SKILLS_ROOT),
        *public_agent_skill_dirs(),
    ]


def shipped_markdown_files() -> list[Path]:
    return [path for skill_dir in shipped_skill_dirs() for path in sorted(skill_dir.rglob("*.md"))]


def location(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def graphql_queries_by_location() -> dict[str, str]:
    """Every GraphQL example: fenced ```graphql blocks and ``px api graphql '...'`` bodies."""
    queries: dict[str, str] = {}
    for path in shipped_markdown_files():
        text = path.read_text(encoding="utf-8")
        for index, match in enumerate(_GRAPHQL_FENCE.finditer(text)):
            queries[f"{location(path)}#{index}"] = match.group(1)
        for index, query in enumerate(_PX_API_GRAPHQL.findall(text)):
            queries[f"{location(path)}#px-api-graphql-{index}"] = query.replace(
                _SHELL_ESCAPED_SINGLE_QUOTE, "'"
            )
    return queries
