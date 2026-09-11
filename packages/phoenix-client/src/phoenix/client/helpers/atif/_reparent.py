# pyright: reportPrivateUsage=false
"""Reparent spans beneath a caller-owned parent span.

Operates on ``v1.Span`` values without interpreting ATIF documents.
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

    Every span joins ``trace_id`` and keeps its span ID. Parent links within
    the batch stay unchanged. Spans with no parent in the batch attach to
    ``parent_id``, including those whose previous parent is outside the batch.

    The caller must create the common parent and supply distinct input span
    IDs. Duplicate IDs and collisions with ``parent_id`` raise ``ValueError``.
    This helper does not validate cycles. ATIF callers validate the graph
    before reparenting.
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
