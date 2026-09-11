from collections import defaultdict
from typing import Iterable

import sqlalchemy as sa
from sqlalchemy import func, select
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
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        keys = list(keys)
        span_path_segment = sa.cast(models.Span.id, sa.String) + ","
        roots = sa.values(
            sa.Column("root_rowid", sa.Integer),
            name="roots",
        ).data([(key,) for key in set(keys)])

        subtree = (
            select(
                models.Span.id,
                models.Span.span_id,
                models.Span.trace_rowid,
                roots.c.root_rowid,
                (sa.literal(",", sa.String) + span_path_segment).label("path"),
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
                (parents.c.path + span_path_segment).label("path"),
            )
            .join_from(
                parents,
                models.Span,
                sa.and_(
                    models.Span.trace_rowid == parents.c.trace_rowid,
                    models.Span.parent_id == parents.c.span_id,
                ),
            )
            .where(parents.c.path.not_like(sa.literal("%,", sa.String) + span_path_segment + "%"))
        )

        stmt = (
            select(
                subtree.c.root_rowid,
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
                func.sum(models.SpanCostDetail.cost).label("cost"),
                func.sum(models.SpanCostDetail.tokens).label("tokens"),
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
