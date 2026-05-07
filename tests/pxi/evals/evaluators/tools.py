from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from phoenix.evals import create_evaluator


def _as_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _tool_calls(output: Any) -> list[Mapping[str, Any]]:
    value = _as_mapping(output).get("tool_calls", [])
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return []
    return [call for call in value if isinstance(call, Mapping)]


def _tool_name(call: Mapping[str, Any]) -> str | None:
    name = call.get("name")
    return name if isinstance(name, str) else None


def _tool_args(call: Mapping[str, Any]) -> Mapping[str, Any]:
    args = call.get("args", {})
    return args if isinstance(args, Mapping) else {}


def _expected_tools(expected: Any) -> Mapping[str, Any]:
    return _as_mapping(_as_mapping(expected).get("tools", {}))


def _expected_tool_call_args(expected: Any) -> Mapping[str, Any]:
    return _as_mapping(_as_mapping(expected).get("tool_call_args", {}))


def _failure(explanation: str, *, metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "score": 0.0,
        "label": "fail",
        "explanation": explanation,
    }
    if metadata:
        result["metadata"] = dict(metadata)
    return result


def _success() -> dict[str, Any]:
    return {"score": 1.0, "label": "pass"}


@create_evaluator(name="correct_tools_called", kind="code")
def correct_tools_called(
    output: Any,
    expected: Any,
    exact_match: bool = False,
) -> dict[str, Any]:
    tool_expectation = _expected_tools(expected)
    required = list(tool_expectation.get("required") or [])
    forbidden = list(tool_expectation.get("forbidden") or [])

    observed = [name for call in _tool_calls(output) if (name := _tool_name(call)) is not None]

    forbidden_observed = [name for name in forbidden if name in observed]
    if forbidden_observed:
        return _failure(
            f"Forbidden tools were called: {forbidden_observed}",
            metadata={"observed_tools": observed},
        )

    if exact_match and observed != required:
        return _failure(
            f"Expected exact tool sequence {required}, observed {observed}",
            metadata={"observed_tools": observed},
        )

    missing = [name for name in required if name not in observed]
    if missing:
        return _failure(
            f"Required tools were not called: {missing}",
            metadata={"observed_tools": observed},
        )

    return _success()


@create_evaluator(name="tool_call_args_match", kind="code")
def tool_call_args_match(output: Any, expected: Any) -> dict[str, Any]:
    expected_args_by_tool = _expected_tool_call_args(expected)
    observed_calls = _tool_calls(output)
    failures: dict[str, Any] = {}

    for tool_name, expected_args in expected_args_by_tool.items():
        if not isinstance(tool_name, str) or not isinstance(expected_args, Mapping):
            continue
        matching_calls = [call for call in observed_calls if _tool_name(call) == tool_name]
        if not matching_calls:
            failures[tool_name] = {"reason": "tool was not called"}
            continue
        if any(
            all(_tool_args(call).get(key) == value for key, value in expected_args.items())
            for call in matching_calls
        ):
            continue
        failures[tool_name] = {
            "expected": dict(expected_args),
            "observed": [dict(_tool_args(call)) for call in matching_calls],
        }

    if failures:
        return _failure("Tool call arguments did not match expected values", metadata=failures)
    return _success()
