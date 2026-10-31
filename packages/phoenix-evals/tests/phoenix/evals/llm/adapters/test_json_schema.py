from typing import Any, Dict, List

from phoenix.evals.llm.adapters.json_schema import close_objects, walk_schema


def test_closes_nested_objects() -> None:
    item = {"type": "object", "properties": {"x": {"type": "string"}}}
    schema = {
        "type": "object",
        "properties": {
            "maybe": {"type": ["object", "null"]},
            "either": {"anyOf": [{"$ref": "#/$defs/item"}, {"type": "object"}]},
        },
        "$defs": {"item": item},
    }

    closed = close_objects(schema)

    assert closed["additionalProperties"] is False
    assert closed["properties"]["maybe"]["additionalProperties"] is False
    assert closed["properties"]["either"]["anyOf"][1]["additionalProperties"] is False
    assert closed["$defs"]["item"]["additionalProperties"] is False
    assert "additionalProperties" not in item


def test_keeps_values_and_property_names_as_they_are() -> None:
    schema = {
        "type": "object",
        "properties": {
            "type": {"type": "string"},
            "choice": {"enum": [{"type": "object"}], "default": {"type": "object"}},
        },
        "additionalProperties": True,
    }

    closed = close_objects(schema)

    assert closed["additionalProperties"] is True
    assert "additionalProperties" not in closed["properties"]
    assert closed["properties"]["choice"] == schema["properties"]["choice"]


def test_walks_property_schemas_but_not_the_property_map() -> None:
    schema = {
        "type": "object",
        "properties": {"minimum": {"type": "integer"}, "type": {"type": "string"}},
        "$defs": {"oneOf": {"type": "string"}},
    }
    visited: List[Dict[str, Any]] = []

    walk_schema(schema, visited.append)

    assert visited == [
        schema,
        schema["properties"]["minimum"],
        schema["properties"]["type"],
        schema["$defs"]["oneOf"],
    ]
