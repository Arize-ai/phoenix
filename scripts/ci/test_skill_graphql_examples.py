"""Every fenced ```graphql example in a shipped skill validates against the exported schema.

Runs as its own CI job, triggered by changes to the skills or to
``js/app/schema.graphql``, rather than with the Python unit suite.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
import yaml
from graphql import GraphQLSchema, build_schema, parse, validate

from phoenix.server.mcp.skills import PXI_SKILLS_ROOT, SHARED_SKILLS_ROOT

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "js" / "app" / "schema.graphql"
AGENT_SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"
THIRD_PARTY_SKILLS_LOCKFILE = REPO_ROOT / "skills-lock.json"

_GRAPHQL_FENCE = re.compile(r"^[ \t]*```graphql[^\n]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---", re.DOTALL)


def _frontmatter(skill_dir: Path) -> dict[str, Any]:
    match = _FRONTMATTER.match((skill_dir / "SKILL.md").read_text(encoding="utf-8"))
    return yaml.safe_load(match.group(1)) if match else {}


def _is_internal(skill_dir: Path) -> bool:
    return bool(_frontmatter(skill_dir).get("metadata", {}).get("internal"))


def _skill_dirs(root: Path) -> list[Path]:
    return sorted(path for path in root.iterdir() if (path / "SKILL.md").is_file())


def _public_agent_skill_dirs() -> list[Path]:
    third_party = json.loads(THIRD_PARTY_SKILLS_LOCKFILE.read_text(encoding="utf-8"))["skills"]
    return [
        skill_dir
        for skill_dir in _skill_dirs(AGENT_SKILLS_ROOT)
        if skill_dir.name not in third_party and not _is_internal(skill_dir)
    ]


def _shipped_skill_dirs() -> list[Path]:
    return [
        *_skill_dirs(SHARED_SKILLS_ROOT),
        *_skill_dirs(PXI_SKILLS_ROOT),
        *_public_agent_skill_dirs(),
    ]


def _graphql_examples() -> list[tuple[str, str]]:
    examples: list[tuple[str, str]] = []
    for skill_dir in _shipped_skill_dirs():
        for path in sorted(skill_dir.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for index, match in enumerate(_GRAPHQL_FENCE.finditer(text)):
                examples.append((f"{path.relative_to(REPO_ROOT)}#{index}", match.group(1)))
    return examples


GRAPHQL_EXAMPLES = _graphql_examples()


@pytest.fixture(scope="module")
def schema() -> GraphQLSchema:
    return build_schema(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_public_agent_skills_exclude_internal_and_third_party() -> None:
    public = {skill_dir.name for skill_dir in _public_agent_skill_dirs()}
    assert public
    assert not {"phoenix-server", "gh-stack", "agent-browser"} & public


def test_fence_pattern_finds_examples() -> None:
    assert GRAPHQL_EXAMPLES


@pytest.mark.parametrize(
    "label, query", GRAPHQL_EXAMPLES, ids=[label for label, _ in GRAPHQL_EXAMPLES]
)
def test_example_validates_against_exported_schema(
    schema: GraphQLSchema, label: str, query: str
) -> None:
    errors = validate(schema, parse(query))
    assert not errors, f"{label}: {[error.message for error in errors]}"
