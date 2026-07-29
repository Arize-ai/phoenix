"""Shared model-facing schema for evaluator-draft preview payload overrides."""

from typing import Any

MAX_PREVIEW_CASES = 10

MAPPING_SOURCE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "input": {"type": "object", "additionalProperties": True},
        "output": {"type": "object", "additionalProperties": True},
        "reference": {"type": "object", "additionalProperties": True},
        "metadata": {"type": "object", "additionalProperties": True},
    },
    "additionalProperties": False,
}

PREVIEW_CASE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "testPayload": MAPPING_SOURCE_SCHEMA,
    },
    "required": ["id", "testPayload"],
    "additionalProperties": False,
}

PREVIEW_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "cases": {
            "type": "array",
            "description": (
                "Named payload overrides to preview against the current immutable draft. "
                "Case IDs must be non-empty and unique. Omit cases to use the form's current "
                "test payload."
            ),
            "items": PREVIEW_CASE_SCHEMA,
            "minItems": 1,
            "maxItems": MAX_PREVIEW_CASES,
        }
    },
    "additionalProperties": False,
}
