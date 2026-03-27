import re

from strawberry.printer import print_schema

from phoenix.server.api.schema import _EXPORTED_GRAPHQL_SCHEMA


def test_exported_graphql_schema_prints_json_and_list_defaults() -> None:
    schema = print_schema(_EXPORTED_GRAPHQL_SCHEMA)

    assert re.search(r"invocationParameters: JSON! = \{\s*\}", schema)
    assert "evaluators: [PlaygroundEvaluatorInput!]! = []" in schema
    assert re.search(r"metadata: JSON! = \{\s*\}", schema)
