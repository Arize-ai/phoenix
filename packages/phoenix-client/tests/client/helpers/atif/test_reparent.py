# pyright: reportPrivateUsage=false, reportTypedDictNotRequiredAccess=false
"""Tests for reparenting spans beneath a caller-owned parent.

These exercise the transform directly on ``v1.Span`` values, without ATIF
fixtures, since reparenting is independent of how the spans were produced.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, cast

import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.atif._reparent import _reparent_spans_under_common_parent

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

    def test_span_ids_are_preserved(self) -> None:
        result = self.reparent(a_tree())
        assert [s["context"]["span_id"] for s in result] == [
            s["context"]["span_id"] for s in a_tree()
        ]

    def test_different_parents_do_not_change_span_ids(self) -> None:
        first = _reparent_spans_under_common_parent(
            a_tree(),
            parent_id="1" * 16,
            trace_id="1" * 32,
        )
        second = _reparent_spans_under_common_parent(
            a_tree(),
            parent_id="2" * 16,
            trace_id="1" * 32,
        )
        assert [s["context"]["span_id"] for s in first] == [s["context"]["span_id"] for s in second]

    def test_duplicate_span_ids_are_rejected(self) -> None:
        spans = [
            span("first", "aaaaaaaaaaaaaaaa"),
            span("second", "aaaaaaaaaaaaaaaa"),
        ]

        with pytest.raises(ValueError, match="duplicate span IDs: aaaaaaaaaaaaaaaa"):
            self.reparent(spans)

    def test_common_parent_id_collision_is_rejected(self) -> None:
        spans = [span("root", PARENT_SPAN_ID)]

        with pytest.raises(ValueError, match="Common parent span ID collides"):
            self.reparent(spans)

    def test_same_parent_is_deterministic(self) -> None:
        assert [s["context"] for s in self.reparent(a_tree())] == [
            s["context"] for s in self.reparent(a_tree())
        ]

    def test_empty_input(self) -> None:
        assert self.reparent([]) == []

    def test_span_pointing_at_a_missing_parent_is_adopted(self) -> None:
        # Real ATIF data produces these: a step declaring subagent refs but no
        # tool call makes conversion point the subagent at a tool span that is
        # never emitted. Such a span has no parent in the batch, so it is a
        # root and must attach to the common parent rather than dangle.
        spans = a_tree() + [span("orphan", "eeeeeeeeeeeeeeee", parent_id="0000000000000000")]
        result = self.reparent(spans)

        by_name = {s["name"]: s for s in result}
        assert by_name["orphan"]["parent_id"] == PARENT_SPAN_ID

        known = {s["context"]["span_id"] for s in result} | {PARENT_SPAN_ID}
        assert all(s["parent_id"] in known for s in result)

    def test_adoption_does_not_disturb_resolvable_parents(self) -> None:
        spans = a_tree() + [span("orphan", "eeeeeeeeeeeeeeee", parent_id="0000000000000000")]
        result = self.reparent(spans)

        by_name = {s["name"]: s for s in result}
        assert by_name["child"]["parent_id"] == by_name["root"]["context"]["span_id"]
        assert by_name["grandchild"]["parent_id"] == by_name["child"]["context"]["span_id"]
