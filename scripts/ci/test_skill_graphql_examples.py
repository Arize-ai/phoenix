"""Lives outside tests/ so CI runs it only when a skill or ``js/app/schema.graphql`` changes."""

from __future__ import annotations

import pytest
from graphql import GraphQLSchema, build_schema, parse, specified_rules, validate
from graphql.validation.rules.custom.no_deprecated import NoDeprecatedCustomRule
from skill_examples import (
    AGENT_SKILLS_ROOT,
    SCHEMA_PATH,
    graphql_queries_by_location,
    public_agent_skill_dirs,
)

# Deprecated fields and arguments fail validation.
_VALIDATION_RULES = (*specified_rules, NoDeprecatedCustomRule)

QUERIES_BY_LOCATION = graphql_queries_by_location()


@pytest.fixture(scope="module")
def schema() -> GraphQLSchema:
    return build_schema(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_public_agent_skills_exist() -> None:
    assert public_agent_skill_dirs()


@pytest.mark.parametrize(
    "skill_name", ["phoenix-server", "gh-stack"], ids=["internal", "third-party"]
)
def test_non_public_agent_skills_are_excluded(skill_name: str) -> None:
    assert (AGENT_SKILLS_ROOT / skill_name / "SKILL.md").is_file()
    assert skill_name not in {skill_dir.name for skill_dir in public_agent_skill_dirs()}


def test_fence_pattern_finds_examples() -> None:
    assert QUERIES_BY_LOCATION


@pytest.mark.parametrize("query", QUERIES_BY_LOCATION.values(), ids=QUERIES_BY_LOCATION.keys())
def test_example_validates_against_exported_schema(schema: GraphQLSchema, query: str) -> None:
    errors = validate(schema, parse(query), _VALIDATION_RULES)
    assert not errors, [error.message for error in errors]
