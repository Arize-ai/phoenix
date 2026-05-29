"""Unit tests for the matcher vocabulary on ``tool_call_args_match``.

These exercise :func:`evaluate_tool_call_args` directly (the pure-Python core
behind the ``@create_evaluator`` registration) using a synthesized agent
output so we don't have to spin up the full pydantic_ai stack.
"""

from __future__ import annotations

from typing import Any

import pytest

from evals.pxi.evaluators.tools import evaluate_tool_call_args


def _output_with_tool_call(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Build the minimal ``agent_task_output`` shape the evaluator reads.

    Mirrors what pydantic_ai serializes for a ``ModelResponse`` containing a
    single ``ToolCallPart``. Only the fields the evaluator touches are
    populated.
    """
    return {
        "messages": [
            {
                "parts": [
                    {
                        "part_kind": "tool-call",
                        "tool_name": tool_name,
                        "args": args,
                    }
                ]
            }
        ]
    }


class TestLiteralEquality:
    def test_literal_value_passes_on_exact_match(self) -> None:
        output = _output_with_tool_call("set_time_range", {"timeRangeKey": "1h"})
        expected = {"tool_call_args": {"set_time_range": {"timeRangeKey": "1h"}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_literal_value_fails_on_mismatch(self) -> None:
        output = _output_with_tool_call("set_time_range", {"timeRangeKey": "1h"})
        expected = {"tool_call_args": {"set_time_range": {"timeRangeKey": "7d"}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0


class TestContainsAll:
    def test_passes_when_all_substrings_present(self) -> None:
        output = _output_with_tool_call(
            "set_spans_filter",
            {"condition": "start_time >= '2026-04-03T00:00:00Z'", "rootSpansOnly": True},
        )
        expected = {
            "tool_call_args": {
                "set_spans_filter": {"condition": {"contains_all": ["start_time", "2026-04-03"]}}
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_contains_all_is_clause_order_invariant(self) -> None:
        # Real DSL case: "span_kind == 'LLM' and latency_ms >= 5000" should match
        # the model emitting the clauses in either order.
        forward = _output_with_tool_call(
            "set_spans_filter",
            {"condition": "span_kind == 'LLM' and latency_ms >= 5000"},
        )
        reverse = _output_with_tool_call(
            "set_spans_filter",
            {"condition": "latency_ms >= 5000 and span_kind == 'LLM'"},
        )
        expected = {
            "tool_call_args": {
                "set_spans_filter": {
                    "condition": {"contains_all": ["span_kind == 'LLM'", "latency_ms >= 5000"]}
                }
            }
        }
        assert evaluate_tool_call_args(forward, expected)["score"] == 1.0
        assert evaluate_tool_call_args(reverse, expected)["score"] == 1.0

    def test_fails_when_one_substring_missing(self) -> None:
        output = _output_with_tool_call(
            "set_spans_filter", {"condition": "start_time >= '2026-05-01'"}
        )
        expected = {
            "tool_call_args": {
                "set_spans_filter": {"condition": {"contains_all": ["start_time", "2026-04-03"]}}
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0


class TestContainsAny:
    def test_passes_when_at_least_one_substring_present(self) -> None:
        output = _output_with_tool_call("set_time_range", {"timeRangeKey": "24h"})
        expected = {
            "tool_call_args": {
                "set_time_range": {"timeRangeKey": {"contains_any": ["1d", "24h", "1day"]}}
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_fails_when_no_substring_present(self) -> None:
        output = _output_with_tool_call("set_time_range", {"timeRangeKey": "7d"})
        expected = {
            "tool_call_args": {"set_time_range": {"timeRangeKey": {"contains_any": ["1d", "24h"]}}}
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0


class TestNotContains:
    def test_passes_when_no_forbidden_substrings_present(self) -> None:
        output = _output_with_tool_call("set_spans_filter", {"condition": "span_kind == 'LLM'"})
        expected = {
            "tool_call_args": {
                "set_spans_filter": {"condition": {"not_contains": ["TOOL", "CHAIN"]}}
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_fails_when_forbidden_substring_present(self) -> None:
        output = _output_with_tool_call("set_spans_filter", {"condition": "span_kind == 'TOOL'"})
        expected = {
            "tool_call_args": {"set_spans_filter": {"condition": {"not_contains": ["TOOL"]}}}
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0

    def test_fails_when_key_absent(self) -> None:
        output = _output_with_tool_call("set_spans_filter", {})
        expected = {
            "tool_call_args": {
                "set_spans_filter": {"condition": {"not_contains": ["latency_ms < "]}}
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0


class TestAnyMatcher:
    def test_passes_when_key_present(self) -> None:
        output = _output_with_tool_call(
            "set_spans_filter", {"condition": "span_kind == 'LLM'", "rootSpansOnly": True}
        )
        expected = {
            "tool_call_args": {
                "set_spans_filter": {
                    "condition": "span_kind == 'LLM'",
                    "rootSpansOnly": {"any": True},
                }
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_any_passes_with_falsy_value(self) -> None:
        # ``rootSpansOnly: False`` is a legitimate value; ``any`` should accept it.
        output = _output_with_tool_call(
            "set_spans_filter", {"condition": "x", "rootSpansOnly": False}
        )
        expected = {"tool_call_args": {"set_spans_filter": {"rootSpansOnly": {"any": True}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    def test_any_fails_when_key_absent(self) -> None:
        output = _output_with_tool_call("set_spans_filter", {"condition": "x"})
        expected = {"tool_call_args": {"set_spans_filter": {"rootSpansOnly": {"any": True}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0


class TestNonEmptyMatcher:
    def test_passes_when_string_contains_non_whitespace_text(self) -> None:
        output = _output_with_tool_call(
            "save_prompt", {"description": "Tighten routing instructions"}
        )
        expected = {"tool_call_args": {"save_prompt": {"description": {"non_empty": True}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0

    @pytest.mark.parametrize("description", ["", "   ", "\n\t"])
    def test_fails_when_string_is_blank(self, description: str) -> None:
        output = _output_with_tool_call("save_prompt", {"description": description})
        expected = {"tool_call_args": {"save_prompt": {"description": {"non_empty": True}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0

    def test_fails_when_key_absent(self) -> None:
        output = _output_with_tool_call("save_prompt", {"instanceId": 1})
        expected = {"tool_call_args": {"save_prompt": {"description": {"non_empty": True}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 0.0

    def test_can_be_combined_with_contains_all(self) -> None:
        output = _output_with_tool_call(
            "save_prompt", {"description": "Adds stricter handoff criteria"}
        )
        expected = {
            "tool_call_args": {
                "save_prompt": {
                    "description": {
                        "non_empty": True,
                        "contains_all": ["stricter", "handoff"],
                    }
                }
            }
        }
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0


class TestEqualsMatcher:
    def test_explicit_equals_matcher(self) -> None:
        output = _output_with_tool_call("set_time_range", {"timeRangeKey": "1h"})
        expected = {"tool_call_args": {"set_time_range": {"timeRangeKey": {"equals": "1h"}}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0


class TestUnconstrainedArgsAreIgnored:
    def test_args_not_in_expected_are_not_checked(self) -> None:
        # ``rootSpansOnly`` not in expected at all -- evaluator ignores it.
        output = _output_with_tool_call(
            "set_spans_filter", {"condition": "x", "rootSpansOnly": True}
        )
        expected = {"tool_call_args": {"set_spans_filter": {"condition": "x"}}}
        assert evaluate_tool_call_args(output, expected)["score"] == 1.0


class TestMatcherSchemaErrors:
    @pytest.mark.parametrize(
        "matcher",
        [
            {"contains_all": "not-a-list"},
            {"contains_any": [1, 2]},
            {"not_contains": None},
            {"any": False},
            {"non_empty": False},
        ],
    )
    def test_malformed_matcher_fails_with_error(self, matcher: dict[str, Any]) -> None:
        output = _output_with_tool_call("set_spans_filter", {"condition": "x"})
        expected = {"tool_call_args": {"set_spans_filter": {"condition": matcher}}}
        result = evaluate_tool_call_args(output, expected)
        assert result["score"] == 0.0
        metadata = result.get("metadata", {})
        # Failure metadata identifies the malformed matcher.
        assert "set_spans_filter" in metadata
