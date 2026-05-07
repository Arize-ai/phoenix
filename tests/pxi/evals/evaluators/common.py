from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any


def _as_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def get_tool_calls(output: Any) -> list[Mapping[str, Any]]:
    output_map = _as_mapping(output)
    tool_calls = output_map.get("tool_calls", [])
    if not isinstance(tool_calls, Sequence) or isinstance(tool_calls, str):
        return []
    return [call for call in tool_calls if isinstance(call, Mapping)]


def get_tool_name(call: Mapping[str, Any]) -> str | None:
    name = call.get("name")
    return name if isinstance(name, str) else None


def get_tool_args(call: Mapping[str, Any]) -> Mapping[str, Any]:
    args = call.get("args", {})
    return args if isinstance(args, Mapping) else {}


def get_expected_section(expected: Any, section: str) -> Mapping[str, Any]:
    expected_map = _as_mapping(expected)
    value = expected_map.get(section, {})
    return value if isinstance(value, Mapping) else {}


def score_failure(explanation: str, *, metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "score": 0.0,
        "label": "fail",
        "explanation": explanation,
    }
    if metadata:
        result["metadata"] = dict(metadata)
    return result


def score_success() -> dict[str, Any]:
    return {"score": 1.0, "label": "pass"}
