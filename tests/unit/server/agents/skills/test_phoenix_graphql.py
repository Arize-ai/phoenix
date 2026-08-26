from __future__ import annotations

import re
from typing import TypeAlias

import pytest
from graphql import parse, validate

from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.mcp.skills import PXI_SKILLS_ROOT, Skill

_GRAPHQL_BLOCK = re.compile(r"```graphql\n(.*?)```", re.DOTALL)
GraphQLExample: TypeAlias = tuple[str, str]
SkillContentSource: TypeAlias = tuple[str, str]

PHOENIX_GRAPHQL_SKILL = Skill.from_directory(PXI_SKILLS_ROOT / "phoenix-graphql")


def _iter_graphql_examples() -> list[GraphQLExample]:
    """Yield (source_label, query_text) for every ```graphql block in the skill.

    Covers the skill body and every resource so a renamed schema field fails the
    suite instead of silently rotting the documented examples.
    """
    sources: list[SkillContentSource] = [("SKILL.md body", PHOENIX_GRAPHQL_SKILL.body)]
    for resource in PHOENIX_GRAPHQL_SKILL.resources:
        sources.append((f"resource:{resource.name}", resource.read()))

    examples: list[GraphQLExample] = []
    for label, text in sources:
        for idx, match in enumerate(_GRAPHQL_BLOCK.finditer(text)):
            examples.append((f"{label}#{idx}", match.group(1).strip()))
    return examples


_GRAPHQL_EXAMPLES = _iter_graphql_examples()


def test_skill_documents_graphql_examples() -> None:
    # Guard against the extractor silently matching nothing.
    assert _GRAPHQL_EXAMPLES, "expected at least one ```graphql example in the skill"


@pytest.mark.parametrize(
    "label, query",
    _GRAPHQL_EXAMPLES,
    ids=[label for label, _ in _GRAPHQL_EXAMPLES],
)
def test_example_queries_validate_against_live_schema(label: str, query: str) -> None:
    """Every documented example must parse and validate against the real schema.

    This is the anti-rot guard: if a field or argument is renamed in the
    GraphQL schema, the corresponding skill example fails here.
    """
    schema = build_graphql_schema()
    errors = validate(schema._schema, parse(query))
    assert not errors, f"{label} failed schema validation: {[str(e) for e in errors]}"
