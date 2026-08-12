# pyright: reportPrivateUsage=false, reportTypedDictNotRequiredAccess=false
"""Tests for reparenting spans beneath a caller-owned parent.

These exercise the transform directly on ``v1.Span`` values, without ATIF
fixtures, since reparenting is independent of how the spans were produced.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, cast

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.atif._reparent import (
    _reparent_span,
    _reparent_spans_under_common_parent,
)

PARENT_TRACE_ID = "0123456789abcdef0123456789abcdef"
PARENT_SPAN_ID = "0123456789abcdef"


def span(
    name: str,
    span_id: str,
    *,
    trace_id: str = "f" * 32,
    parent_id: Optional[str] = None,
) -> v1.Span:
    payload: Dict[str, Any] = {
        "name": name,
        "context": {"trace_id": trace_id, "span_id": span_id},
        "span_kind": "AGENT",
        "start_time": "2024-01-01T00:00:00+00:00",
        "end_time": "2024-01-01T00:00:01+00:00",
        "status_code": "OK",
    }
    if parent_id is not None:
        payload["parent_id"] = parent_id
    return cast(v1.Span, payload)


def a_tree() -> List[v1.Span]:
    """Root with one child and one grandchild."""
    return [
        span("root", "aaaaaaaaaaaaaaaa"),
        span("child", "bbbbbbbbbbbbbbbb", parent_id="aaaaaaaaaaaaaaaa"),
        span("grandchild", "cccccccccccccccc", parent_id="bbbbbbbbbbbbbbbb"),
    ]


class TestReparentSpan:
    def test_sets_parent_and_trace(self) -> None:
        result = _reparent_span(
            span("root", "aaaaaaaaaaaaaaaa"),
            parent_id=PARENT_SPAN_ID,
            trace_id=PARENT_TRACE_ID,
        )
        assert result["parent_id"] == PARENT_SPAN_ID
        assert result["context"]["trace_id"] == PARENT_TRACE_ID

    def test_does_not_mutate_input(self) -> None:
        original = span("root", "aaaaaaaaaaaaaaaa")
        snapshot = {**original, "context": {**original["context"]}}
        _reparent_span(
            original,
            parent_id=PARENT_SPAN_ID,
            trace_id=PARENT_TRACE_ID,
        )
        assert original == snapshot

    def test_preserves_other_fields(self) -> None:
        original = span("root", "aaaaaaaaaaaaaaaa")
        original["attributes"] = {"llm.model_name": "gpt-4"}
        result = _reparent_span(
            original,
            parent_id=PARENT_SPAN_ID,
            trace_id=PARENT_TRACE_ID,
        )
        assert result["name"] == "root"
        assert result["attributes"] == {"llm.model_name": "gpt-4"}


class TestReparentSpansUnderCommonParent:
    def reparent(self, spans: List[v1.Span]) -> List[v1.Span]:
        return _reparent_spans_under_common_parent(
            spans,
            parent_id=PARENT_SPAN_ID,
            trace_id=PARENT_TRACE_ID,
        )

    def test_only_roots_attach_to_common_parent(self) -> None:
        result = self.reparent(a_tree())
        by_name = {s["name"]: s for s in result}
        assert by_name["root"]["parent_id"] == PARENT_SPAN_ID
        assert by_name["child"]["parent_id"] == by_name["root"]["context"]["span_id"]
        assert by_name["grandchild"]["parent_id"] == by_name["child"]["context"]["span_id"]

    def test_all_spans_join_the_parent_trace(self) -> None:
        result = self.reparent(a_tree())
        assert {s["context"]["trace_id"] for s in result} == {PARENT_TRACE_ID}

    def test_multiple_roots_all_attach(self) -> None:
        spans = a_tree() + [span("second-root", "dddddddddddddddd", trace_id="e" * 32)]
        result = self.reparent(spans)
        roots = [s["name"] for s in result if s["parent_id"] == PARENT_SPAN_ID]
        assert sorted(roots) == ["root", "second-root"]

    def test_span_ids_are_rederived(self) -> None:
        result = self.reparent(a_tree())
        original_ids = {s["context"]["span_id"] for s in a_tree()}
        new_ids = {s["context"]["span_id"] for s in result}
        assert original_ids.isdisjoint(new_ids)
        assert len(new_ids) == len(original_ids)

    def test_different_parents_produce_disjoint_ids(self) -> None:
        first = _reparent_spans_under_common_parent(
            a_tree(),
            parent_id="1" * 16,
            trace_id="1" * 32,
        )
        second = _reparent_spans_under_common_parent(
            a_tree(),
            parent_id="2" * 16,
            trace_id="2" * 32,
        )
        assert {s["context"]["span_id"] for s in first}.isdisjoint(
            s["context"]["span_id"] for s in second
        )

    def test_same_parent_is_deterministic(self) -> None:
        assert [s["context"] for s in self.reparent(a_tree())] == [
            s["context"] for s in self.reparent(a_tree())
        ]

    def test_empty_input(self) -> None:
        assert self.reparent([]) == []
