"""Every fenced ```graphql example in a skill must validate against the exported schema.

Skills document GraphQL for agents to copy verbatim. Without this check a renamed
field or argument would rot silently in the prose while the schema moved on. Each
example is validated against ``js/app/schema.graphql``, the export CI keeps in
sync with the Strawberry schema, so the test needs neither a database nor an app.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from graphql import GraphQLSchema, build_schema, parse, validate

from phoenix.server.mcp.skills import PXI_SKILLS_ROOTS

REPO_ROOT = Path(__file__).resolve().parents[5]
SCHEMA_PATH = REPO_ROOT / "js" / "app" / "schema.graphql"
SKILL_ROOTS: tuple[Path, ...] = (*PXI_SKILLS_ROOTS, REPO_ROOT / ".agents" / "skills")

_DOC_SUFFIXES = frozenset({".md", ".mdx", ".xml", ".j2"})
_GRAPHQL_FENCE = re.compile(r"^[ \t]*```graphql[^\n]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)


def _graphql_examples() -> list[tuple[str, str]]:
    """(label, query) for every fenced graphql block under the skill roots."""
    examples: list[tuple[str, str]] = []
    for root in SKILL_ROOTS:
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix not in _DOC_SUFFIXES:
                continue
            text = path.read_text(encoding="utf-8")
            for index, match in enumerate(_GRAPHQL_FENCE.finditer(text)):
                examples.append((f"{path.relative_to(REPO_ROOT)}#{index}", match.group(1)))
    return examples


GRAPHQL_EXAMPLES = _graphql_examples()


@pytest.fixture(scope="module")
def schema() -> GraphQLSchema:
    return build_schema(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_skills_document_graphql_examples() -> None:
    """Guards the extractor: a fence pattern that matches nothing would pass vacuously."""
    assert GRAPHQL_EXAMPLES


@pytest.mark.parametrize(
    "label, query", GRAPHQL_EXAMPLES, ids=[label for label, _ in GRAPHQL_EXAMPLES]
)
def test_example_validates_against_exported_schema(
    schema: GraphQLSchema, label: str, query: str
) -> None:
    errors = validate(schema, parse(query))
    assert not errors, f"{label}: {[error.message for error in errors]}"
