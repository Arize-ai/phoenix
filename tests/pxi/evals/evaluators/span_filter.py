from __future__ import annotations

from typing import Any

from phoenix.evals import create_evaluator

from tests.pxi.evals.evaluators.common import (
    get_expected_section,
    get_tool_args,
    get_tool_calls,
    get_tool_name,
    score_failure,
    score_success,
)

SET_SPANS_FILTER_TOOL_NAME = "set_spans_filter"


@create_evaluator(name="set_spans_filter_args_match", kind="code")
def set_spans_filter_args_match(output: Any, expected: Any) -> dict[str, Any]:
    expected_args = get_expected_section(expected, "set_spans_filter")
    expected_condition = expected_args.get("condition")
    expected_root_spans_only = expected_args.get("rootSpansOnly")

    calls = [
        call
        for call in get_tool_calls(output)
        if get_tool_name(call) == SET_SPANS_FILTER_TOOL_NAME
    ]
    if not calls:
        return score_failure("No set_spans_filter tool call observed")
    if len(calls) > 1:
        return score_failure(
            f"Expected one set_spans_filter call, observed {len(calls)}",
            metadata={"observed_calls": calls},
        )

    observed_args = get_tool_args(calls[0])
    observed_condition = observed_args.get("condition")
    observed_root_spans_only = observed_args.get("rootSpansOnly")
    if (
        observed_condition != expected_condition
        or observed_root_spans_only != expected_root_spans_only
    ):
        return score_failure(
            "set_spans_filter arguments did not match expected values",
            metadata={
                "expected": {
                    "condition": expected_condition,
                    "rootSpansOnly": expected_root_spans_only,
                },
                "observed": {
                    "condition": observed_condition,
                    "rootSpansOnly": observed_root_spans_only,
                },
            },
        )

    return score_success()
