from __future__ import annotations

import re

import pytest
from graphql import parse, validate

from phoenix.server.agents.capabilities.skills import ContentSkillResource
from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
from phoenix.server.api.schema import build_graphql_schema

_GRAPHQL_BLOCK = re.compile(r"```graphql\n(.*?)```", re.DOTALL)


def _iter_graphql_examples() -> list[tuple[str, str]]:
    """Yield (source_label, query_text) for every ```graphql block in the skill.

    Covers the skill body and every resource so a renamed schema field fails the
    suite instead of silently rotting the documented examples.
    """
    sources: list[tuple[str, str]] = [("SKILL.md body", PHOENIX_GRAPHQL_SKILL.content)]
    for resource in PHOENIX_GRAPHQL_SKILL.resources:
        assert isinstance(resource, ContentSkillResource)
        sources.append((f"resource:{resource.name}", resource.content))

    examples: list[tuple[str, str]] = []
    for label, text in sources:
        for idx, match in enumerate(_GRAPHQL_BLOCK.finditer(text)):
            examples.append((f"{label}#{idx}", match.group(1).strip()))
    return examples


_EXPECTED_RESOURCE_NAMES = {
    "project-spans-traces",
    "sessions",
    "datasets",
    "experiments",
    "prompts",
    "annotations",
}


def test_skill_metadata() -> None:
    assert PHOENIX_GRAPHQL_SKILL.name == "phoenix-graphql"
    assert PHOENIX_GRAPHQL_SKILL.description.strip()
    assert PHOENIX_GRAPHQL_SKILL.summary.strip()


def test_exposes_one_resource_per_schema_domain() -> None:
    names = {resource.name for resource in PHOENIX_GRAPHQL_SKILL.resources}
    assert names == _EXPECTED_RESOURCE_NAMES


def test_every_resource_has_a_manifest_description_and_content() -> None:
    for resource in PHOENIX_GRAPHQL_SKILL.resources:
        assert isinstance(resource, ContentSkillResource)
        assert resource.description, f"{resource.name} is missing a manifest description"
        assert resource.content.strip(), f"{resource.name} has empty content"


def test_body_points_at_resources_instead_of_inlining_schema() -> None:
    body = PHOENIX_GRAPHQL_SKILL.content
    # The body advertises the schema map and the read mechanism...
    assert "Schema map" in body
    assert "read_skill_resource" in body
    # ...and every resource is named in the map so the model knows what to request.
    for name in _EXPECTED_RESOURCE_NAMES:
        assert name in body, f"resource '{name}' is not referenced in the skill body"


@pytest.mark.parametrize(
    "resource_name, expected_substring",
    [
        ("datasets", "datasetVersionId"),
        ("experiments", "compareExperiments"),
        ("prompts", "call with no args to get the latest version"),
        ("sessions", "traceLatencyMsQuantile"),
        ("annotations", "annotatorKind"),
        ("project-spans-traces", "rootSpansOnly"),
    ],
)
def test_resource_content_covers_key_facts(resource_name: str, expected_substring: str) -> None:
    resource = next(r for r in PHOENIX_GRAPHQL_SKILL.resources if r.name == resource_name)
    assert isinstance(resource, ContentSkillResource)
    assert expected_substring in resource.content


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
