from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.evaluators.suggestion_accepted import (
    APPROVAL_DECISION_ATTRIBUTE,
    APPROVAL_SOURCE_ATTRIBUTE,
    SUGGESTION_ACCEPTED,
    evaluate_suggestion_accepted,
)
from evals.pxi.online_evals.models import SpanSelector


def _tool_span(
    *,
    tool_name: str | None = "edit_prompt_instance",
    span_name: str = "edit_prompt_instance",
    decision: Any = ...,
    source: Any = ...,
    output: Any = ...,
) -> v1.Span:
    attributes: dict[str, Any] = {}
    if tool_name is not None:
        attributes["tool.name"] = tool_name
    if decision is not ...:
        attributes[APPROVAL_DECISION_ATTRIBUTE] = decision
    if source is not ...:
        attributes[APPROVAL_SOURCE_ATTRIBUTE] = source
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
        span_kinds=("TOOL",),
        attributes={APPROVAL_SOURCE_ATTRIBUTE: "user"},
    )


def test_selector_names_no_tools() -> None:
    """The point of the marker: discovery must not depend on a tool allowlist.

    A newly approval-gated tool is covered the day it ships, with no change here.
    """
    assert SUGGESTION_ACCEPTED.selector.names == ()


def test_selector_targets_tool_spans_anywhere_in_the_trace() -> None:
    """Approval-gated tools are not roots, so discovery must not restrict parents."""
    assert SUGGESTION_ACCEPTED.selector.parent_id is None


def test_selector_excludes_automatic_accepts_at_discovery() -> None:
    """Bypass-mode accepts are not evidence of what a user wanted."""
    assert SUGGESTION_ACCEPTED.selector.attributes == ((APPROVAL_SOURCE_ATTRIBUTE, "user"),)


# --- acceptance ----------------------------------------------------------


def test_manual_acceptance_scores_one() -> None:
    score = _evaluate(_tool_span(decision="accepted", source="user"))

    assert score is not None
    assert score.label == "accepted"
    assert score.score == 1.0
    assert score.name == "suggestion_accepted"
    assert score.kind == "code"
    assert score.explanation == "user accepted the edit_prompt_instance suggestion"
    assert score.metadata == {"tool_name": "edit_prompt_instance"}


@pytest.mark.parametrize("tool_name", ["save_prompt", "load_dataset", "create_dataset"])
def test_accept_vocabulary_no_longer_matters(tool_name: str) -> None:
    """Tools disagree on their success word (`saved`, `loaded`, ...).

    The marker is uniform, so classification is identical across all of them —
    including tools that were missing from the old hand-maintained allowlist.
    """
    score = _evaluate(
        _tool_span(
            tool_name=tool_name,
            decision="accepted",
            source="user",
            output={"status": "saved", "approvalStatus": "accepted"},
        )
    )

    assert score is not None
    assert (score.label, score.score) == ("accepted", 1.0)
    assert score.metadata == {"tool_name": tool_name}


def test_tool_name_falls_back_to_the_span_name() -> None:
    score = _evaluate(
        _tool_span(
            tool_name=None,
            span_name="load_dataset",
            decision="accepted",
            source="user",
        )
    )

    assert score is not None
    assert score.metadata == {"tool_name": "load_dataset"}


# --- rejection -----------------------------------------------------------


def test_explicit_rejection_scores_zero() -> None:
    score = _evaluate(_tool_span(decision="rejected", source="user"))

    assert score is not None
    assert score.label == "rejected"
    assert score.score == 0.0
    assert score.explanation == "user rejected the edit_prompt_instance suggestion"
    assert score.metadata == {"tool_name": "edit_prompt_instance"}


# --- not applicable ------------------------------------------------------


@pytest.mark.parametrize(
    ("case", "decision", "source"),
    [
        ("automatic accept", "accepted", "auto"),
        ("unknown source", "accepted", "system"),
        ("unknown decision", "deferred", "user"),
        ("empty decision", "", "user"),
        ("non-string decision", 1, "user"),
    ],
)
def test_non_user_decisions_are_not_annotated(case: str, decision: Any, source: Any) -> None:
    assert _evaluate(_tool_span(decision=decision, source=source)) is None, case


@pytest.mark.parametrize(
    "case",
    ["no marker at all", "decision only", "source only"],
)
def test_unmarked_spans_are_not_annotated(case: str) -> None:
    """Cancellations, errors, and still-pending approvals carry no marker."""
    kwargs: dict[str, Any] = {}
    if case == "decision only":
        kwargs["decision"] = "accepted"
    elif case == "source only":
        kwargs["source"] = "user"
    assert _evaluate(_tool_span(**kwargs)) is None, case


def test_output_payload_never_drives_classification() -> None:
    """Only the promoted attributes decide; a look-alike payload must not leak in.

    This is what lets a read-only tool carry `status: "rejected"` in its own
    output without being mistaken for an approval decision.
    """
    assert (
        _evaluate(
            _tool_span(
                tool_name="query_phoenix",
                output={"status": "rejected", "acceptedBy": "user"},
            )
        )
        is None
    )


def test_annotation_never_carries_the_raw_payload() -> None:
    secret = "SENSITIVE-PROMPT-BODY"
    score = _evaluate(
        _tool_span(
            decision="accepted",
            source="user",
            output={
                "status": "accepted",
                "promptId": "prompt-abc123",
                "content": secret,
                "diff": f"- old\n+ {secret}",
            },
        )
    )

    assert score is not None
    assert score.metadata == {"tool_name": "edit_prompt_instance"}
    assert secret not in json.dumps({"e": score.explanation, "m": score.metadata})
    assert "prompt-abc123" not in json.dumps({"e": score.explanation, "m": score.metadata})


def test_attribute_names_match_the_server_that_writes_them() -> None:
    """The eval reads attributes the Phoenix server writes.

    A drifted name would not raise — discovery would simply return nothing,
    forever, and look like a quiet window. Pin the two constants together.
    """
    from phoenix.server.agents import approval as server_approval

    assert APPROVAL_DECISION_ATTRIBUTE == server_approval.APPROVAL_DECISION_ATTRIBUTE
    assert APPROVAL_SOURCE_ATTRIBUTE == server_approval.APPROVAL_SOURCE_ATTRIBUTE


@pytest.mark.parametrize("decision", ["accepted", "rejected"])
def test_every_decision_the_server_emits_is_classified(decision: str) -> None:
    """The server only ever writes these two; neither may fall through as None."""
    assert _evaluate(_tool_span(decision=decision, source="user")) is not None
