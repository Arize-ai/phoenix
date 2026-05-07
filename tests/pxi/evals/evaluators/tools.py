from __future__ import annotations

from typing import Any

from phoenix.evals import create_evaluator

from tests.pxi.evals.evaluators.common import (
    get_expected_section,
    get_tool_calls,
    get_tool_name,
    score_failure,
    score_success,
)


@create_evaluator(name="strict_tools_called", kind="code")
def strict_tools_called(output: Any, expected: Any) -> dict[str, Any]:
    tool_expectation = get_expected_section(expected, "tools")
    required = list(tool_expectation.get("required") or [])
    forbidden = list(tool_expectation.get("forbidden") or [])
    strict = bool(tool_expectation.get("strict", True))

    observed = [
        name
        for call in get_tool_calls(output)
        if (name := get_tool_name(call)) is not None
    ]

    forbidden_observed = [name for name in forbidden if name in observed]
    if forbidden_observed:
        return score_failure(
            f"Forbidden tools were called: {forbidden_observed}",
            metadata={"observed_tools": observed},
        )

    if strict and observed != required:
        return score_failure(
            f"Expected exact tool sequence {required}, observed {observed}",
            metadata={"observed_tools": observed},
        )

    missing = [name for name in required if name not in observed]
    if missing:
        return score_failure(
            f"Required tools were not called: {missing}",
            metadata={"observed_tools": observed},
        )

    return score_success()
