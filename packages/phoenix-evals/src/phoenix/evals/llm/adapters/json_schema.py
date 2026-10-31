"""JSON Schema helpers shared by the adapters' native structured output paths."""

import copy
from typing import Any, Callable, Dict

# Keywords whose values are data, not subschemas, so schema walks skip them.
_DATA_KEYWORDS = frozenset({"const", "default", "enum", "examples"})
# Keywords whose values map names to subschemas, so schema walks visit the values only.
_SCHEMA_MAPS = frozenset(
    {"$defs", "definitions", "dependentSchemas", "patternProperties", "properties"}
)


def walk_schema(schema: Any, visit: Callable[[Dict[str, Any]], None]) -> None:
    """Calls `visit` on every subschema of a JSON Schema, including the root.

    `visit` runs on a subschema before its children, so it can change which children are walked.
    """
    if isinstance(schema, list):
        for item in schema:
            walk_schema(item, visit)
        return
    if not isinstance(schema, dict):
        return
    visit(schema)
    for key, value in schema.items():
        if key in _DATA_KEYWORDS:
            continue
        if key in _SCHEMA_MAPS and isinstance(value, dict):
            for subschema in value.values():
                walk_schema(subschema, visit)
        else:
            walk_schema(value, visit)


def close_objects(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Returns a copy of the schema with `additionalProperties: false` on every object.

    OpenAI and Anthropic structured output both require it. Objects that already set
    `additionalProperties` keep their value.
    """
    closed = copy.deepcopy(schema)

    def close(node: Dict[str, Any]) -> None:
        schema_type = node.get("type")
        if schema_type == "object" or (isinstance(schema_type, list) and "object" in schema_type):
            node.setdefault("additionalProperties", False)

    walk_schema(closed, close)
    return closed
