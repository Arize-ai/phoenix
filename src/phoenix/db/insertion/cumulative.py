from collections import defaultdict
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


@dataclass
class CumulativeCount:
    errors: int
    prompt_tokens: int
    completion_tokens: int


def _get_cumulative_counts(spans: Sequence[models.Span]) -> list[CumulativeCount]:
    """
    Computes cumulative counts.

    Returns a list of counts for each span in the same order as the input spans.
    """

    root_span_ids: list[str] = []
    parent_to_children_ids: dict[str, list[str]] = {}
    counts_by_span_id: dict[str, CumulativeCount] = {}
    for span in spans:
        if span.parent_id is None:
            root_span_ids.append(span.span_id)
        else:
            if span.parent_id not in parent_to_children_ids:
                parent_to_children_ids[span.parent_id] = []
            parent_to_children_ids[span.parent_id].append(span.span_id)
        counts_by_span_id[span.span_id] = CumulativeCount(
            errors=int(span.status_code == "ERROR"),
            prompt_tokens=span.llm_token_count_prompt or 0,
            completion_tokens=span.llm_token_count_completion or 0,
        )

    # iterative post-order traversal
    for root_span_id in root_span_ids:
        visited_children = False
        stack: list[tuple[str, bool]] = [(root_span_id, visited_children)]
        while stack:
            span_id, visited_children = stack.pop()
            if not visited_children:
                stack.append((span_id, True))
                for child_id in parent_to_children_ids.get(span_id, []):
                    stack.append((child_id, False))
            else:
                count = counts_by_span_id[span_id]
                for child_id in parent_to_children_ids.get(span_id, []):
                    child_counts = counts_by_span_id[child_id]
                    count.errors += child_counts.errors
                    count.prompt_tokens += child_counts.prompt_tokens
                    count.completion_tokens += child_counts.completion_tokens

    return [counts_by_span_id[span.span_id] for span in spans]


async def recompute_trace_cumulative_values(
    session: AsyncSession,
    trace_rowids: set[int],
) -> None:
    """
    Recomputes and persists cumulative counts for all spans in the given traces.

    Fetches all spans for each trace, runs the post-order traversal to compute
    cumulative error/token counts, then bulk-updates each span's cumulative columns.
    """
    if not trace_rowids:
        return

    spans = list(
        await session.scalars(select(models.Span).where(models.Span.trace_rowid.in_(trace_rowids)))
    )
    if not spans:
        return

    # Group spans by trace
    spans_by_trace: dict[int, list[models.Span]] = defaultdict(list)
    for span in spans:
        spans_by_trace[span.trace_rowid].append(span)

    # Compute cumulative counts per trace and collect updates
    updates: list[dict[str, int]] = []
    for trace_spans in spans_by_trace.values():
        counts = _get_cumulative_counts(trace_spans)
        for span, count in zip(trace_spans, counts):
            updates.append(
                {
                    "id": span.id,
                    "cumulative_error_count": count.errors,
                    "cumulative_llm_token_count_prompt": count.prompt_tokens,
                    "cumulative_llm_token_count_completion": count.completion_tokens,
                }
            )

    if updates:
        await session.execute(
            update(models.Span),
            updates,
        )
