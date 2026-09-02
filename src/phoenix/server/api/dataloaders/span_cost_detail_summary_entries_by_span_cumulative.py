from collections import defaultdict
from typing import Iterable

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import (
    CostBreakdown,
    SpanCostDetailSummaryEntry,
)
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
Key: TypeAlias = SpanRowId
Result: TypeAlias = list[SpanCostDetailSummaryEntry]


class SpanCostDetailSummaryEntriesBySpanCumulativeDataLoader(DataLoader[Key, Result]):
    """
    Aggregates SpanCostDetail rows, grouped by token type, across a span and
    all of its descendants (children, grandchildren, etc.). Mirrors
    SpanCostDetailSummaryEntriesByTraceDataLoader, but scoped to the subtree
    rooted at each key instead of the whole trace, the same way
    Span.cumulative_token_count_prompt is scoped relative to
    Trace.rootSpan.cumulativeTokenCountPrompt.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        roots = sa.values(
            sa.Column("root_rowid", sa.Integer),
            name="roots",
        ).data([(key,) for key in keys])

        subtree = (
            select(
                models.Span.id,
                models.Span.span_id,
                models.Span.trace_rowid,
                roots.c.root_rowid,
            )
            .join_from(roots, models.Span, models.Span.id == roots.c.root_rowid)
            .cte("subtree", recursive=True)
        )
        parents = subtree.alias("parents")
        subtree = subtree.union_all(
            select(
                models.Span.id,
                models.Span.span_id,
                models.Span.trace_rowid,
                parents.c.root_rowid,
            ).join_from(
                parents,
                models.Span,
                sa.and_(
                    models.Span.trace_rowid == parents.c.trace_rowid,
                    models.Span.parent_id == parents.c.span_id,
                ),
            )
        )

        stmt = (
            select(
                subtree.c.root_rowid,
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
                coalesce(func.sum(models.SpanCostDetail.cost), 0).label("cost"),
                coalesce(func.sum(models.SpanCostDetail.tokens), 0).label("tokens"),
            )
            .select_from(subtree)
            .join(models.SpanCost, models.SpanCost.span_rowid == subtree.c.id)
            .join(
                models.SpanCostDetail,
                models.SpanCostDetail.span_cost_id == models.SpanCost.id,
            )
            .group_by(
                subtree.c.root_rowid,
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
            )
        )

        results: defaultdict[Key, Result] = defaultdict(list)
        async with self._db.read() as session:
            data = await session.stream(stmt)
            async for (
                root_rowid,
                token_type,
                is_prompt,
                cost,
                tokens,
            ) in data:
                entry = SpanCostDetailSummaryEntry(
                    token_type=token_type,
                    is_prompt=is_prompt,
                    value=CostBreakdown(tokens=tokens, cost=cost),
                )
                results[root_rowid].append(entry)
        return list(map(list, map(results.__getitem__, keys)))
