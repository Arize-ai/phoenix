# pyright: reportPrivateUsage=false
"""Reparent converted spans beneath a caller-owned parent span.

This module operates purely on ``v1.Span`` values and knows nothing about
ATIF. Conversion decides a span tree's internal shape; reparenting decides
where that tree hangs. Keeping the two separate means the grouping logic is
a small, independently testable transform rather than a special case
threaded through the converter.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

from phoenix.client.__generated__ import v1

from ._convert import _sha256_span_id


def _rederive_span_id(span_id: str, trace_id: str) -> str:
    """Return a span ID scoped to ``trace_id``.

    Phoenix requires span IDs to be globally unique, not unique per trace.
    Converted spans get IDs derived from the trajectory document, so the same
    trajectory placed under two different parents would otherwise emit
    colliding IDs and the second upload would conflict. Mixing the
    destination trace ID into the seed keeps IDs deterministic per parent
    while making them distinct across parents.
    """
    return _sha256_span_id(f"{trace_id}:{span_id}")


def _reparent_span(
    span: v1.Span,
    *,
    parent_id: str,
    trace_id: str,
) -> v1.Span:
    """Return a copy of ``span`` moved under ``parent_id`` in ``trace_id``."""
    reparented: v1.Span = {
        **span,
        "context": {**span["context"], "trace_id": trace_id},
        "parent_id": parent_id,
    }
    return reparented


def _reparent_spans_under_common_parent(
    spans: Sequence[v1.Span],
    *,
    parent_id: str,
    trace_id: str,
) -> List[v1.Span]:
    """Return ``spans`` regrouped as one tree beneath a caller-owned parent.

    Every span joins ``trace_id``. Spans that are already children keep their
    existing parent, so relationships established during conversion — subagent
    handoffs, continuations, turn nesting — are preserved; only root spans
    (those with no parent) are attached to ``parent_id``.

    Span IDs are rederived against ``trace_id`` so that converting the same
    spans under different parents cannot collide. ``parent_id`` refers to a
    span the caller already created and is used as given.
    """
    id_map: Dict[str, str] = {
        span["context"]["span_id"]: _rederive_span_id(span["context"]["span_id"], trace_id)
        for span in spans
    }
    reparented: List[v1.Span] = []
    for span in spans:
        existing_parent_id = span.get("parent_id")
        new_parent_id = (
            id_map.get(existing_parent_id, existing_parent_id) if existing_parent_id else parent_id
        )
        span_with_new_id: v1.Span = {
            **span,
            "context": {
                **span["context"],
                "span_id": id_map[span["context"]["span_id"]],
            },
        }
        reparented.append(
            _reparent_span(span_with_new_id, parent_id=new_parent_id, trace_id=trace_id)
        )
    return reparented
