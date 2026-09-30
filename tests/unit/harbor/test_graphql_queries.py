"""Every ``.graphql`` file under the Harbor evaluations must validate against the Phoenix
schema, so a verifier cannot ship a query the server would reject."""

from pathlib import Path

import pytest
from graphql import GraphQLSchema, build_schema, parse, validate

ROOT = Path(__file__).resolve().parents[3]
HARBOR_DIR = ROOT / "evals" / "harbor"
SCHEMA_PATH = ROOT / "js" / "app" / "schema.graphql"
QUERY_FILES = sorted(HARBOR_DIR.rglob("*.graphql"))


@pytest.fixture(scope="module")
def schema() -> GraphQLSchema:
    return build_schema(SCHEMA_PATH.read_text())


def test_at_least_one_query_file_exists() -> None:
    assert QUERY_FILES, f"no .graphql files under {HARBOR_DIR}"


@pytest.mark.parametrize("path", QUERY_FILES, ids=lambda path: str(path.relative_to(HARBOR_DIR)))
def test_query_validates_against_the_phoenix_schema(path: Path, schema: GraphQLSchema) -> None:
    document = parse(path.read_text())
    errors = validate(schema, document)
    assert not errors, "\n".join(error.message for error in errors)
