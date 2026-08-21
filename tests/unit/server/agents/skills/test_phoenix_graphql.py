from __future__ import annotations

import re
from pathlib import Path
from typing import TypeAlias

import pytest
from graphql import parse, validate

from phoenix.server.api.schema import build_graphql_schema

_GRAPHQL_BLOCK = re.compile(r"```graphql\n(.*?)```", re.DOTALL)
_SKILLS_DIR = (
    Path(__file__).resolve().parents[5] / "src" / "phoenix" / "server" / "agents" / "prompts" / "skills"
)
GraphQLExample: TypeAlias = tuple[str, str]


def _iter_graphql_examples() -> list[GraphQLExample]:
    """Return every GraphQL fence in every prompt skill and resource.

    This intentionally scans files rather than registered resources: an unregistered
    or newly added resource must receive the same anti-rot validation.
    """
    examples: list[GraphQLExample] = []
    for path in sorted(_SKILLS_DIR.rglob("*")):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for idx, match in enumerate(_GRAPHQL_BLOCK.finditer(text)):
            examples.append((f"{path.relative_to(_SKILLS_DIR)}#{idx}", match.group(1).strip()))
    return examples


_GRAPHQL_EXAMPLES = _iter_graphql_examples()


def test_skill_documents_graphql_examples() -> None:
    # Guard against the extractor silently matching nothing.
    assert _GRAPHQL_EXAMPLES, "expected at least one ```graphql example under prompts/skills"


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
