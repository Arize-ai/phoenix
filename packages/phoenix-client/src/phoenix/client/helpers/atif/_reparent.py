# pyright: reportPrivateUsage=false
"""Reparent spans beneath a caller-owned parent span.

Operates purely on ``v1.Span`` values and knows nothing about ATIF. Conversion
decides a span tree's internal shape; reparenting decides where that tree
hangs.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

from phoenix.client.__generated__ import v1

from ._convert import _sha256_span_id


def _rederive_span_id(span_id: str, trace_id: str) -> str:
    """Return a span ID scoped to ``trace_id``.

    Phoenix requires span IDs to be globally unique, not unique per trace.
    Span IDs derived from trajectory content repeat whenever the same content
    is converted again, so mixing the destination trace ID into the seed keeps
    them deterministic per parent while making them distinct across parents.
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
    handoffs, continuations, turn nesting — are preserved.

    A span is treated as a root, and attached to ``parent_id``, when it has no
    parent *within this batch*. That covers both spans with no ``parent_id`` at
    all and spans whose ``parent_id`` refers to a span that is not present.
    The latter happens with real ATIF data: a step can declare
    ``subagent_trajectory_ref`` while carrying no tool call, in which case
    conversion points the subagent at a tool span that is never emitted.
    Attaching those to the common parent keeps the result a single connected
    tree instead of leaving subtrees dangling off a nonexistent span.

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
        # Fall back to the common parent when the referenced parent is absent,
        # so an unresolvable link cannot orphan a subtree.
        new_parent_id = (
            id_map.get(existing_parent_id, parent_id) if existing_parent_id else parent_id
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
