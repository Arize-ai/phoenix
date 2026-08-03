from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.evaluators.suggestion_accepted import (
    APPROVAL_GATED_TOOLS,
    SUGGESTION_ACCEPTED,
    evaluate_suggestion_accepted,
)
from evals.pxi.online_evals.models import SpanSelector


def _tool_span(
    *,
    tool_name: str | None = "edit_prompt_instance",
    span_name: str = "edit_prompt_instance",
    output: Any = ...,
) -> v1.Span:
    attributes: dict[str, Any] = {}
    if tool_name is not None:
        attributes["tool.name"] = tool_name
    if output is not ...:
        attributes["output.value"] = output
    span: v1.Span = {
        "name": span_name,
        "context": {"trace_id": "trace-1", "span_id": "tool-1"},
        "span_kind": "TOOL",
        "parent_id": "root-1",
        "start_time": "2026-07-24T00:00:00+00:00",
        "end_time": "2026-07-24T00:00:01+00:00",
        "status_code": "OK",
        "attributes": attributes,
    }
    return span


def _evaluate(span: v1.Span) -> Any:
    return asyncio.run(evaluate_suggestion_accepted(span, [span]))


# --- spec / registration -------------------------------------------------


def test_spec_configuration() -> None:
    assert SUGGESTION_ACCEPTED.name == "suggestion_accepted"
    assert SUGGESTION_ACCEPTED.annotator_kind == "CODE"
    assert SUGGESTION_ACCEPTED.sample_rate == 1.0
    assert SUGGESTION_ACCEPTED.identifier == "pxi-online-evals:suggestion-accepted:v1"
    assert SUGGESTION_ACCEPTED.selector == SpanSelector(
        names=APPROVAL_GATED_TOOLS, span_kinds=("TOOL",)
    )


def test_selector_targets_tool_spans_anywhere_in_the_trace() -> None:
    """Approval-gated tools are not roots, so discovery must not restrict parents."""
    assert SUGGESTION_ACCEPTED.selector.parent_id is None


def test_allowlist_is_sorted_and_unique() -> None:
    assert list(APPROVAL_GATED_TOOLS) == sorted(set(APPROVAL_GATED_TOOLS))


@pytest.mark.parametrize(
    "excluded",
    ["submit_code_evaluator_draft", "submit_llm_evaluator_draft"],
)
def test_manual_submit_tools_are_excluded(excluded: str) -> None:
    """These record only `awaiting_user`; the dialog's decision never reaches the span."""
    assert excluded not in APPROVAL_GATED_TOOLS


# --- acceptance ----------------------------------------------------------


@pytest.mark.parametrize("status", ["accepted", "saved", "loaded", "applied", "removed"])
@pytest.mark.parametrize("encoding", ["mapping", "json", "double_json"])
def test_manual_acceptance_scores_one(status: str, encoding: str) -> None:
    """`acceptedBy == "user"` is the acceptance signal, whatever the tool's
    success vocabulary, and whichever encoding layer the output arrived in."""
    payload: dict[str, Any] = {"status": status, "acceptedBy": "user"}
    output: Any = payload
    if encoding == "json":
        output = json.dumps(payload)
    elif encoding == "double_json":
        output = json.dumps(json.dumps(payload))

    score = _evaluate(_tool_span(output=output))

    assert score is not None
    assert score.label == "accepted"
    assert score.score == 1.0
    assert score.name == "suggestion_accepted"
    assert score.kind == "code"
    assert score.explanation == "user accepted the edit_prompt_instance suggestion"
    assert score.metadata == {"tool_name": "edit_prompt_instance"}


def test_save_prompt_object_output_with_approval_status_is_accepted() -> None:
    score = _evaluate(
        _tool_span(
            tool_name="save_prompt",
            output={"status": "saved", "approvalStatus": "accepted", "acceptedBy": "user"},
        )
    )

    assert score is not None
    assert (score.label, score.score) == ("accepted", 1.0)
    assert score.metadata == {"tool_name": "save_prompt"}


def test_tool_name_falls_back_to_the_span_name() -> None:
    score = _evaluate(
        _tool_span(
            tool_name=None,
            span_name="load_dataset",
            output={"status": "loaded", "acceptedBy": "user"},
        )
    )

    assert score is not None
    assert score.metadata == {"tool_name": "load_dataset"}


# --- rejection -----------------------------------------------------------


def test_explicit_rejection_scores_zero() -> None:
    """The reject callback writes `status: "rejected"` and never sets acceptedBy."""
    score = _evaluate(_tool_span(output={"status": "rejected", "message": "user declined"}))

    assert score is not None
    assert score.label == "rejected"
    assert score.score == 0.0
    assert score.explanation == "user rejected the edit_prompt_instance suggestion"
    assert score.metadata == {"tool_name": "edit_prompt_instance"}


def test_contradictory_payload_follows_the_rejection_first_rule() -> None:
    """A terminal rejection outranks an acceptance marker that should not co-occur."""
    score = _evaluate(_tool_span(output={"status": "rejected", "acceptedBy": "user"}))

    assert score is not None
    assert (score.label, score.score) == ("rejected", 0.0)


# --- not applicable ------------------------------------------------------


@pytest.mark.parametrize(
    ("case", "output"),
    [
        ("automatic accept", {"status": "accepted", "acceptedBy": "auto"}),
        ("system accept", {"status": "accepted", "acceptedBy": "system"}),
        ("accept without a source", {"status": "accepted"}),
        ("awaiting the user", {"status": "awaiting_user", "message": "review the draft"}),
        ("navigation cancellation", {"state": "output-error", "errorText": "cancelled"}),
        ("tool error", {"state": "output-error", "errorText": "boom"}),
        ("unknown state", {"status": "no_change"}),
        ("empty object", {}),
        ("array output", [{"status": "rejected"}]),
        ("scalar output", 7),
        ("null output", None),
        ("empty string", ""),
        ("whitespace string", "   "),
        ("malformed json", "{not json"),
        ("json array string", "[1, 2]"),
        ("json scalar string", '"accepted"'),
    ],
)
def test_non_decisions_are_not_annotated(case: str, output: Any) -> None:
    assert _evaluate(_tool_span(output=output)) is None, case


def test_missing_output_is_not_annotated() -> None:
    assert _evaluate(_tool_span(output=...)) is None


def test_non_allowlisted_tool_is_not_annotated() -> None:
    """A read tool can carry look-alike fields but has no approval to record."""
    assert (
        _evaluate(
            _tool_span(
                tool_name="query_phoenix",
                output={"status": "rejected", "acceptedBy": "user"},
            )
        )
        is None
    )


def test_message_text_never_drives_classification() -> None:
    """Classification is structural: prose mentioning the words must not leak in."""
    assert (
        _evaluate(
            _tool_span(
                output={
                    "status": "awaiting_user",
                    "message": "the user accepted nothing yet; nothing was rejected either",
                }
            )
        )
        is None
    )


def test_annotation_never_carries_the_raw_payload() -> None:
    secret = "SENSITIVE-PROMPT-BODY"
    score = _evaluate(
        _tool_span(
            output={
                "status": "accepted",
                "acceptedBy": "user",
                "promptId": "prompt-abc123",
                "content": secret,
                "diff": f"- old\n+ {secret}",
            }
        )
    )

    assert score is not None
    assert score.metadata == {"tool_name": "edit_prompt_instance"}
    assert secret not in json.dumps({"e": score.explanation, "m": score.metadata})
    assert "prompt-abc123" not in json.dumps({"e": score.explanation, "m": score.metadata})
