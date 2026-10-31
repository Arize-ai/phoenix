"""Where the shipped skills live, and how the examples inside them are found.

Shared by the ``scripts/ci/test_skill_*_examples.py`` checks, which live outside ``tests/`` so
CI runs them only when a skill (or the artifact they validate against) changes.
"""

from __future__ import annotations

import re
from pathlib import Path

from phoenix.server.mcp.skills import PXI_SKILLS_ROOT

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "js" / "app" / "schema.graphql"
PUBLIC_SKILLS_ROOT = REPO_ROOT / "skills"

_GRAPHQL_FENCE = re.compile(r"^[ \t]*```graphql[^\n]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
# A single-quoted query passed to the CLI, e.g. ``px api graphql '{ ... }'``. The body may
# contain the shell's escaped single quote, `'\''`.
_PX_API_GRAPHQL = re.compile(r"px api graphql '((?:[^']|'\\'')*)'")
_SHELL_ESCAPED_SINGLE_QUOTE = "'\\''"


def _skill_dirs(root: Path) -> list[Path]:
    return sorted(path for path in root.iterdir() if (path / "SKILL.md").is_file())


def public_skill_dirs() -> list[Path]:
    """The public skills; ``make skills-check`` keeps their server copies identical."""
    return _skill_dirs(PUBLIC_SKILLS_ROOT)


def shipped_skill_dirs() -> list[Path]:
    return [*public_skill_dirs(), *_skill_dirs(PXI_SKILLS_ROOT)]


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
