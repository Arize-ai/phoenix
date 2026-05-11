"""Unit tests for PXI eval-harness evaluators.

These tests are intentionally not collected by ``tox -e unit_tests`` because the
``tests/pxi/evals`` tree lives outside the unit-test root. Run them directly:

    uv run pytest tests/pxi/evals/test_evaluators.py
"""

from __future__ import annotations

from typing import Any

import pytest

from tests.pxi.evals.evaluators.tools import (
    _normalize_arg_value,
    evaluate_tool_call_args,
    evaluate_tools_called,
)


def _output(*tool_names: str) -> dict[str, Any]:
    return {
        "messages": [
            {
                "kind": "response",
                "parts": [
                    {"part_kind": "tool-call", "tool_name": name, "args": {}}
                    for name in tool_names
                ],
            }
        ]
    }


def _expected(
    *,
    required: list[str] | None = None,
    forbidden: list[str] | None = None,
    exact_match: bool = False,
) -> dict[str, Any]:
    tools: dict[str, Any] = {
        "required": required or [],
        "forbidden": forbidden or [],
        "exact_match": exact_match,
    }
    return {"tools": tools}


class TestCorrectToolsCalled:
    def test_correct_when_required_called_no_forbidden(self) -> None:
        result = evaluate_tools_called(
            output=_output("set_spans_filter"),
            expected=_expected(required=["set_spans_filter"]),
        )
        assert result["score"] == 1.0
        assert result["label"] == "correct"

    def test_reads_tool_calls_from_pydantic_ai_messages(self) -> None:
        result = evaluate_tools_called(
            output=_output("docs_search", "set_spans_filter"),
            expected=_expected(required=["set_spans_filter"]),
        )
        assert result["score"] == 1.0
        assert result["label"] == "correct"

    def test_correct_when_no_constraints_and_no_calls(self) -> None:
        result = evaluate_tools_called(output=_output(), expected=_expected())
        assert result["score"] == 1.0
        assert result["label"] == "correct"

    def test_called_forbidden(self) -> None:
        result = evaluate_tools_called(
            output=_output("set_spans_filter", "delete_data"),
            expected=_expected(required=["set_spans_filter"], forbidden=["delete_data"]),
        )
        assert result["score"] == 0.0
        assert result["label"] == "called_forbidden"
        assert "delete_data" in result["explanation"]
        assert result["metadata"]["observed_tools"] == ["set_spans_filter", "delete_data"]

    def test_missing_required(self) -> None:
        result = evaluate_tools_called(
            output=_output("get_traces"),
            expected=_expected(required=["set_spans_filter"]),
        )
        assert result["score"] == 0.0
        assert result["label"] == "missing_required"
        assert "set_spans_filter" in result["explanation"]

    def test_forbidden_trumps_missing_required(self) -> None:
        # Forbidden was called, AND a required tool was not called. The
        # ``called_forbidden`` label is more actionable, so it wins.
        result = evaluate_tools_called(
            output=_output("delete_data"),
            expected=_expected(required=["set_spans_filter"], forbidden=["delete_data"]),
        )
        assert result["label"] == "called_forbidden"

    def test_missing_required_trumps_not_exact_match(self) -> None:
        # In strict mode, if a required tool is missing AND the observed
        # sequence doesn't equal required, prefer the more specific
        # ``missing_required`` label over ``not_exact_match``.
        result = evaluate_tools_called(
            output=_output("get_traces", "list_projects"),
            expected=_expected(required=["set_spans_filter"], exact_match=True),
        )
        assert result["label"] == "missing_required"

    def test_not_exact_match_extra_call(self) -> None:
        # All required were called, but in strict mode an extra call breaks
        # the exact-sequence equality.
        result = evaluate_tools_called(
            output=_output("set_spans_filter", "set_spans_filter"),
            expected=_expected(required=["set_spans_filter"], exact_match=True),
        )
        assert result["score"] == 0.0
        assert result["label"] == "not_exact_match"

    def test_not_exact_match_wrong_order(self) -> None:
        result = evaluate_tools_called(
            output=_output("set_time_range", "set_spans_filter"),
            expected=_expected(required=["set_spans_filter", "set_time_range"], exact_match=True),
        )
        assert result["label"] == "not_exact_match"

    def test_non_strict_allows_extras(self) -> None:
        # Default (non-strict) mode allows extra observed calls beyond
        # required.
        result = evaluate_tools_called(
            output=_output("set_spans_filter", "set_time_range"),
            expected=_expected(required=["set_spans_filter"]),
        )
        assert result["label"] == "correct"

    def test_non_strict_allows_wrong_order(self) -> None:
        result = evaluate_tools_called(
            output=_output("set_time_range", "set_spans_filter"),
            expected=_expected(required=["set_spans_filter", "set_time_range"]),
        )
        assert result["label"] == "correct"

    def test_exact_match_passes_when_sequence_matches(self) -> None:
        result = evaluate_tools_called(
            output=_output("set_spans_filter", "set_time_range"),
            expected=_expected(required=["set_spans_filter", "set_time_range"], exact_match=True),
        )
        assert result["label"] == "correct"

    @pytest.mark.parametrize(
        "expected",
        [
            {},  # missing tools key entirely
            {"tools": {}},  # empty tools dict
            {"tools": {"required": [], "forbidden": []}},
        ],
    )
    def test_no_constraints_passes(self, expected: dict[str, Any]) -> None:
        result = evaluate_tools_called(
            output=_output("any_tool"),
            expected=expected,
        )
        assert result["label"] == "correct"


def _output_with_args(name: str, args: dict[str, Any]) -> dict[str, Any]:
    return {
        "messages": [
            {
                "kind": "response",
                "parts": [{"part_kind": "tool-call", "tool_name": name, "args": args}],
            }
        ]
    }


class TestNormalizeArgValue:
    def test_passes_non_strings_through(self) -> None:
        assert _normalize_arg_value(True) is True
        assert _normalize_arg_value(5) == 5
        assert _normalize_arg_value(None) is None

    def test_passes_strings_without_and_through(self) -> None:
        assert _normalize_arg_value("span_kind == 'LLM'") == "span_kind == 'LLM'"
        assert _normalize_arg_value("") == ""

    def test_normalizes_and_conjunction_to_set(self) -> None:
        result = _normalize_arg_value("span_kind == 'LLM' and latency_ms >= 5000")
        assert result == frozenset({"span_kind == 'LLM'", "latency_ms >= 5000"})

    def test_conjunction_order_does_not_matter(self) -> None:
        a = _normalize_arg_value("span_kind == 'LLM' and latency_ms >= 5000")
        b = _normalize_arg_value("latency_ms >= 5000 and span_kind == 'LLM'")
        assert a == b


class TestToolCallArgsMatch:
    def _expected(self, **per_tool: dict[str, Any]) -> dict[str, Any]:
        return {"tool_call_args": per_tool}

    def test_passes_when_all_expected_keys_match(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_spans_filter", {"condition": "span_kind == 'LLM'", "rootSpansOnly": False}
            ),
            expected=self._expected(
                set_spans_filter={"condition": "span_kind == 'LLM'", "rootSpansOnly": False},
            ),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"

    def test_reads_args_from_pydantic_ai_messages(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_spans_filter", {"condition": "span_kind == 'LLM'", "rootSpansOnly": False}
            ),
            expected=self._expected(
                set_spans_filter={"condition": "span_kind == 'LLM'", "rootSpansOnly": False},
            ),
        )
        assert result["label"] == "pass"

    def test_subset_match_allows_extra_observed_keys(self) -> None:
        # Observed call carries an extra arg the dataset doesn't mention.
        # Documented behavior: subset match passes.
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_spans_filter",
                {"condition": "span_kind == 'LLM'", "rootSpansOnly": False, "limit": 100},
            ),
            expected=self._expected(
                set_spans_filter={"condition": "span_kind == 'LLM'"},
            ),
        )
        assert result["label"] == "pass"

    def test_fails_when_value_differs(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_spans_filter", {"condition": "span_kind == 'LLM'", "rootSpansOnly": True}
            ),
            expected=self._expected(
                set_spans_filter={"condition": "span_kind == 'LLM'", "rootSpansOnly": False},
            ),
        )
        assert result["label"] == "fail"
        assert "set_spans_filter" in result["metadata"]

    def test_fails_when_tool_not_called(self) -> None:
        result = evaluate_tool_call_args(
            output=_output(),
            expected=self._expected(set_spans_filter={"condition": ""}),
        )
        assert result["label"] == "fail"
        assert result["metadata"]["set_spans_filter"]["reason"] == "tool was not called"

    def test_and_conjunction_order_does_not_fail(self) -> None:
        # Composite condition emitted in opposite order from the dataset
        # should still pass — this is exactly the ``slow-llm-spans``
        # scenario flagged in review.
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_spans_filter",
                {
                    "condition": "latency_ms >= 5000 and span_kind == 'LLM'",
                    "rootSpansOnly": False,
                },
            ),
            expected=self._expected(
                set_spans_filter={
                    "condition": "span_kind == 'LLM' and latency_ms >= 5000",
                    "rootSpansOnly": False,
                }
            ),
        )
        assert result["label"] == "pass"

    def test_any_of_match_across_multiple_calls(self) -> None:
        # When a tool is called twice, the check passes if ANY call
        # satisfies the expected pairs.
        result = evaluate_tool_call_args(
            output={
                "messages": [
                    {
                        "kind": "response",
                        "parts": [
                            {
                                "part_kind": "tool-call",
                                "tool_name": "set_spans_filter",
                                "args": {"condition": "wrong"},
                            },
                            {
                                "part_kind": "tool-call",
                                "tool_name": "set_spans_filter",
                                "args": {"condition": "right"},
                            },
                        ],
                    }
                ]
            },
            expected=self._expected(set_spans_filter={"condition": "right"}),
        )
        assert result["label"] == "pass"
