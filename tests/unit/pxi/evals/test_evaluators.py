"""Unit tests for PXI eval-harness evaluators.

Run directly:

    uv run pytest tests/unit/pxi/evals/test_evaluators.py
"""

from __future__ import annotations

from typing import Any

import pytest

from evals.pxi.evaluators.links import evaluate_in_app_links
from evals.pxi.evaluators.tools import (
    evaluate_tool_call_args,
    evaluate_tools_called,
)


def _output(*tool_names: str) -> dict[str, Any]:
    return {
        "messages": [
            {
                "kind": "response",
                "parts": [
                    {"part_kind": "tool-call", "tool_name": name, "args": {}} for name in tool_names
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


def _link_output(assistant_text: str | None) -> dict[str, Any]:
    return {"assistant_text": assistant_text}


def _link_expected(*required: str) -> dict[str, Any]:
    return {"tools": {"required": []}, "links": {"required_in_app": list(required)}}


class TestInAppLinksValid:
    def test_required_root_relative_markdown_link_passes(self) -> None:
        result = evaluate_in_app_links(
            output=_link_output("Open [Agent settings](/settings/agents)."),
            expected=_link_expected("/settings/agents"),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"

    def test_dynamic_resource_markdown_link_passes(self) -> None:
        result = evaluate_in_app_links(
            output=_link_output(
                "Open the [PXI link evals dataset](/datasets/RGF0YXNldDox/experiments)."
            ),
            expected=_link_expected("/datasets/RGF0YXNldDox/experiments"),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"
        assert result["metadata"]["observed_markdown_hrefs"] == [
            "/datasets/RGF0YXNldDox/experiments"
        ]

    def test_missing_required_path_fails(self) -> None:
        result = evaluate_in_app_links(
            output=_link_output("Open [General settings](/settings/general)."),
            expected=_link_expected("/settings/agents"),
        )
        assert result["score"] == 0.0
        assert result["label"] == "fail"
        assert result["metadata"]["missing_required_in_app"] == ["/settings/agents"]

    def test_absolute_local_app_link_fails(self) -> None:
        result = evaluate_in_app_links(
            output=_link_output("Open [Agent settings](http://localhost:6006/settings/agents)."),
            expected=_link_expected("/settings/agents"),
        )
        assert result["label"] == "fail"
        assert result["metadata"]["invalid_in_app_hrefs"] == [
            "http://localhost:6006/settings/agents"
        ]

    def test_bare_url_fails(self) -> None:
        result = evaluate_in_app_links(
            output=_link_output("Open http://localhost:6006/settings/agents."),
            expected=_link_expected("/settings/agents"),
        )
        assert result["label"] == "fail"
        assert result["metadata"]["bare_urls"] == ["http://localhost:6006/settings/agents."]


class TestToolCallArgsMatch:
    """Tests for the generic ``tool_call_args_match`` evaluator.

    The generic evaluator uses exact value comparison (no DSL semantic
    normalization) and skips tools that have a specialized arg-match
    evaluator (currently just ``set_spans_filter``). These tests use
    ``set_time_range`` to cover the generic path.
    """

    def _expected(self, **per_tool: dict[str, Any] | list[dict[str, Any]]) -> dict[str, Any]:
        return {"tool_call_args": per_tool}

    def test_passes_when_all_expected_keys_match(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "1h"}),
            expected=self._expected(set_time_range={"timeRangeKey": "1h"}),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"

    def test_subset_match_allows_extra_observed_keys(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_time_range", {"timeRangeKey": "1h", "startTime": "2025-01-01T00:00:00Z"}
            ),
            expected=self._expected(set_time_range={"timeRangeKey": "1h"}),
        )
        assert result["label"] == "pass"

    def test_fails_when_value_differs(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "7d"}),
            expected=self._expected(set_time_range={"timeRangeKey": "1h"}),
        )
        assert result["label"] == "fail"

    def test_fails_when_tool_not_called(self) -> None:
        result = evaluate_tool_call_args(
            output=_output(),
            expected=self._expected(set_time_range={"timeRangeKey": "1h"}),
        )
        assert result["label"] == "fail"

    def test_decodes_args_when_serialized_as_json_string(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_time_range",
                '{"timeRangeKey": "1h"}',  # type: ignore[arg-type]
            ),
            expected=self._expected(set_time_range={"timeRangeKey": "1h"}),
        )
        assert result["label"] == "pass"

    def test_does_not_normalize_and_reorder_for_generic_tools(self) -> None:
        # The generic evaluator does NOT apply DSL normalization. If a
        # future generic tool happens to have an arg containing ``and``,
        # clause reordering is treated as a real difference.
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"note": "b and a"}),
            expected=self._expected(set_time_range={"note": "a and b"}),
        )
        assert result["label"] == "fail"

    def test_absent_matcher_passes_when_arg_is_omitted(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("save_prompt", {"instanceId": 1}),
            expected=self._expected(
                save_prompt={
                    "instanceId": 1,
                    "promptId": {"absent": True},
                    "name": {"absent": True},
                }
            ),
        )
        assert result["label"] == "pass"

    def test_absent_matcher_fails_when_arg_is_present(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("save_prompt", {"instanceId": 1, "promptId": "UHJvbXB0OjE="}),
            expected=self._expected(save_prompt={"promptId": {"absent": True}}),
        )
        assert result["label"] == "fail"

    def test_absent_matcher_cannot_be_combined_with_other_matchers(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("save_prompt", {}),
            expected=self._expected(save_prompt={"promptId": {"absent": True, "any": True}}),
        )
        assert result["label"] == "fail"
        assert (
            "cannot be combined" in result["metadata"]["save_prompt"]["matcher_errors"]["promptId"]
        )

    # ---------------- Variant-list pattern ----------------

    def test_variant_list_passes_when_first_variant_matches(self) -> None:
        # A list of acceptable arg dicts. Observed call matches the first.
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "1h"}),
            expected=self._expected(
                set_time_range=[
                    {"timeRangeKey": "1h"},
                    {"timeRangeKey": "1d"},
                    {"timeRangeKey": "7d"},
                ],
            ),
        )
        assert result["label"] == "pass"

    def test_variant_list_passes_when_any_later_variant_matches(self) -> None:
        # Matching a non-first variant still passes.
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "7d"}),
            expected=self._expected(
                set_time_range=[
                    {"timeRangeKey": "1h"},
                    {"timeRangeKey": "1d"},
                    {"timeRangeKey": "7d"},
                ],
            ),
        )
        assert result["label"] == "pass"

    def test_variant_list_fails_when_no_variant_matches(self) -> None:
        # Observed call satisfies none of the variants -> fail. The
        # failure metadata lists all variants.
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "30d"}),
            expected=self._expected(
                set_time_range=[
                    {"timeRangeKey": "1h"},
                    {"timeRangeKey": "1d"},
                ],
            ),
        )
        assert result["label"] == "fail"
        assert isinstance(result["metadata"]["set_time_range"]["expected"], list)
        assert len(result["metadata"]["set_time_range"]["expected"]) == 2

    def test_variant_list_applies_subset_match_per_variant(self) -> None:
        # Each variant uses subset matching: observed may carry extra keys.
        # Here the agent picks custom with a startTime; one variant accepts
        # just timeRangeKey: custom, which is a subset of the observed call.
        result = evaluate_tool_call_args(
            output=_output_with_args(
                "set_time_range",
                {"timeRangeKey": "custom", "startTime": "2025-01-15T00:00:00Z"},
            ),
            expected=self._expected(
                set_time_range=[
                    {"timeRangeKey": "1d"},
                    {"timeRangeKey": "custom"},
                ],
            ),
        )
        assert result["label"] == "pass"

    def test_variant_list_with_empty_list_fails(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "1h"}),
            expected=self._expected(set_time_range=[]),
        )
        assert result["label"] == "fail"
        assert "non-empty list" in result["metadata"]["set_time_range"]["reason"]

    def test_variant_list_with_malformed_entry_fails(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "1h"}),
            expected=self._expected(
                set_time_range=[
                    {"timeRangeKey": "1h"},
                    "not-a-dict",  # type: ignore[list-item]
                ],
            ),
        )
        assert result["label"] == "fail"
        assert "invalid indices: 1" in result["metadata"]["set_time_range"]["reason"]

    def test_non_dict_arg_expectation_fails(self) -> None:
        result = evaluate_tool_call_args(
            output=_output_with_args("set_time_range", {"timeRangeKey": "1h"}),
            expected={"tool_call_args": {"set_time_range": "not-a-dict"}},
        )
        assert result["label"] == "fail"
        assert "must be an object" in result["metadata"]["set_time_range"]["reason"]
