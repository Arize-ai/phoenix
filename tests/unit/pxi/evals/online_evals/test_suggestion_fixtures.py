"""Tests over sanitized, real-shape PXI approval traces.

Identifiers, text, and timestamps are replaced. Approval markers were added to
the older traces while preserving each tool's original output vocabulary.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pytest
from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.evaluators.suggestion_accepted import SUGGESTION_ACCEPTED
from evals.pxi.online_evals.run import run_evaluators
from evals.pxi.online_evals.topology import span_id

FIXTURE = Path(__file__).parent / "fixtures" / "pxi_suggestion_traces.json"
NOW = datetime(2026, 7, 24, 13, 0, tzinfo=timezone.utc)


def _trace(name: str) -> list[v1.Span]:
    return cast(list[v1.Span], json.loads(FIXTURE.read_text())[name])


class _FixtureSpans:
    def __init__(self, spans: list[v1.Span]) -> None:
        self.spans = spans
        self.writes: list[v1.SpanAnnotationData] = []

    def get_spans(self, **kwargs: Any) -> list[v1.Span]:
        if kwargs.get("trace_ids"):
            return self.spans
        names, kinds = kwargs.get("name"), kwargs.get("span_kind")
        attributes: dict[str, str] = kwargs.get("attributes") or {}
        return [
            span
            for span in self.spans
            if (names is None or span["name"] in names)
            and (kinds is None or span["span_kind"] in kinds)
            and all(
                span.get("attributes", {}).get(key) == value for key, value in attributes.items()
            )
        ]

    def get_span_annotations(self, **_: Any) -> list[v1.SpanAnnotation]:
        return []

    def log_span_annotations(
        self, *, span_annotations: list[v1.SpanAnnotationData], sync: bool
    ) -> list[dict[str, str]]:
        self.writes.extend(span_annotations)
        return [{"id": "1"}]


class _FixtureClient:
    def __init__(self, spans: _FixtureSpans) -> None:
        self.spans = spans


def _annotate(trace_name: str) -> dict[str, tuple[str, float]]:
    spans = _FixtureSpans(_trace(trace_name))
    asyncio.run(
        run_evaluators(
            _FixtureClient(spans),  # type: ignore[arg-type]
            project="pxi_dev",
            specs=[SUGGESTION_ACCEPTED],
            now=NOW,
        )
    )
    return {
        annotation["span_id"]: (
            annotation["result"]["label"],
            annotation["result"]["score"],
        )
        for annotation in spans.writes
    }


def _tool_span(trace_name: str, tool_name: str, *, occurrence: int = 0) -> v1.Span:
    matches = [
        span
        for span in _trace(trace_name)
        if span.get("attributes", {}).get("tool.name") == tool_name
    ]
    return matches[occurrence]


def test_accepted_prompt_edit_classifies_as_accepted() -> None:
    target = _tool_span("accepted_prompt_edit", "edit_prompt_instance")
    assert _annotate("accepted_prompt_edit")[span_id(target)] == ("accepted", 1.0)


def test_rejected_prompt_edit_classifies_as_rejected() -> None:
    target = _tool_span("rejected_prompt_edit", "edit_prompt_instance")
    assert _annotate("rejected_prompt_edit")[span_id(target)] == ("rejected", 0.0)


def test_real_save_prompt_dual_status_shape_is_accepted() -> None:
    target = _tool_span("accepted_prompt_edit", "save_prompt")
    assert _annotate("accepted_prompt_edit")[span_id(target)] == ("accepted", 1.0)


def test_one_turn_keeps_independent_outcomes_per_suggestion() -> None:
    rejected = _tool_span("mixed_annotation_config", "update_annotation_config")
    accepted = _tool_span("mixed_annotation_config", "update_annotation_config", occurrence=1)
    batch = _tool_span("mixed_annotation_config", "batch_span_annotate")

    annotations = _annotate("mixed_annotation_config")

    assert annotations[span_id(rejected)] == ("rejected", 0.0)
    assert annotations[span_id(accepted)] == ("accepted", 1.0)
    assert annotations[span_id(batch)] == ("accepted", 1.0)


@pytest.mark.parametrize(
    ("trace_name", "expected"),
    [
        ("accepted_prompt_edit", 2),
        ("rejected_prompt_edit", 1),
        ("mixed_annotation_config", 3),
    ],
)
def test_only_approval_tools_are_annotated(trace_name: str, expected: int) -> None:
    assert len(_annotate(trace_name)) == expected


def test_fixture_carries_no_production_identifiers() -> None:
    text = FIXTURE.read_text()
    for leaked in (
        "3097dd10334213ca3cb0b8a26d17e771",
        "12b4efd5656472be289562a526fa1a8d",
        "0863f2203b0b3af3bfe0a55a09d11e19",
        "236ced0d91b66e77",
        "8496746e8b057155",
    ):
        assert leaked not in text
