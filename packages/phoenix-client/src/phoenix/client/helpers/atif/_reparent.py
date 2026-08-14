# pyright: reportPrivateUsage=false
"""Reparent spans beneath a caller-owned parent span.

Operates purely on ``v1.Span`` values and knows nothing about ATIF. Conversion
decides a span tree's internal shape; reparenting decides where that tree
hangs.
"""

from __future__ import annotations

from typing import List, Sequence

from phoenix.client.__generated__ import v1


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

    Span IDs are preserved. Callers must give separate logical span trees
    distinct IDs before reparenting them. Duplicate input span IDs are rejected
    because they make parent remapping ambiguous and Phoenix cannot reliably
    ingest them. ``parent_id`` refers to a span the caller already created and
    must not collide with a span in this batch.
    """
    span_ids: set[str] = set()
    duplicate_span_ids: set[str] = set()
    for span in spans:
        span_id = span["context"]["span_id"]
        if span_id in span_ids:
            duplicate_span_ids.add(span_id)
        span_ids.add(span_id)
    if duplicate_span_ids:
        duplicates = ", ".join(sorted(duplicate_span_ids))
        raise ValueError(f"Cannot reparent spans with duplicate span IDs: {duplicates}")
    if parent_id in span_ids:
        raise ValueError(f"Common parent span ID collides with an input span ID: {parent_id}")

    reparented: List[v1.Span] = []
    for span in spans:
        existing_parent_id = span.get("parent_id")
        # Fall back to the common parent when the referenced parent is absent,
        # so an unresolvable link cannot orphan a subtree.
        new_parent_id = existing_parent_id if existing_parent_id in span_ids else parent_id
        reparented.append(
            {
                **span,
                "context": {**span["context"], "trace_id": trace_id},
                "parent_id": new_parent_id,
            }
        )
    return reparented
