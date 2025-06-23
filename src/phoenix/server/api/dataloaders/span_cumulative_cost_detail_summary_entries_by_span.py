from typing import Iterable, Optional

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span, SpanCost, SpanCostDetail
from phoenix.server.api.dataloaders.types import CostBreakdown, SpanCostDetailSummaryEntry
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
MaxDepth: TypeAlias = int

Key: TypeAlias = tuple[SpanRowId, Optional[MaxDepth]]
Result: TypeAlias = list[SpanCostDetailSummaryEntry]


class SpanCumulativeCostDetailSummaryEntriesBySpanDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        # Create a values expression with Span.id and respective max_depth (which can be None).
        values = sa.values(
            sa.Column("root_rowid", sa.Integer),
            sa.Column("max_depth", sa.Integer, nullable=True),
            name="values",
        ).data(list(keys))

        # Get the root spans with their depth limits by joining the values to the Span table.
        roots = (
            select(
                Span.span_id,
                values.c.root_rowid,
                values.c.max_depth,
            )
            .join_from(values, Span, Span.id == values.c.root_rowid)
            .subquery("roots")
        )

        # Initialize the recursive common table expression (CTE) with the root span (depth=0)
        # and its direct children (depth=1).
        descendants = (
            select(
                Span.id,
                Span.span_id,
                Span.start_time,
                roots.c.root_rowid,
                roots.c.max_depth,
                sa.literal(0).label("depth"),
            )
            .join_from(
                roots,
                Span,
                Span.id == roots.c.root_rowid,
            )
            .cte("descendants", recursive=True)
        )

        # Build the recursive part of the query to fetch descendants at increasing depths.
        # This recursively finds children of spans in the current depth level.
        parents = descendants.alias("parents")
        descendants = descendants.union_all(
            select(
                Span.id,
                Span.span_id,
                Span.start_time,
                parents.c.root_rowid,
                parents.c.max_depth,
                (parents.c.depth + 1).label("depth"),  # Increment depth for each level
            )
            .join_from(parents, Span, Span.parent_id == parents.c.span_id)
            .where(
                sa.or_(
                    parents.c.max_depth.is_(None),  # No limit if max_depth is NULL
                    parents.c.depth + 1 <= parents.c.max_depth,  # Stop when max depth is reached
                ),
            )
        )

        # Now join with span_costs and span_cost_details to get the detailed cost data
        cost_detail_stmt = (
            select(
                descendants.c.root_rowid,
                descendants.c.max_depth,
                SpanCostDetail.token_type,
                SpanCostDetail.is_prompt,
                coalesce(func.sum(SpanCostDetail.cost), 0).label("cost"),
                coalesce(func.sum(SpanCostDetail.tokens), 0).label("tokens"),
            )
            .select_from(descendants)
            .outerjoin(SpanCost, SpanCost.span_rowid == descendants.c.id)
            .outerjoin(SpanCostDetail, SpanCostDetail.span_cost_id == SpanCost.id)
            .group_by(
                descendants.c.root_rowid,
                descendants.c.max_depth,
                SpanCostDetail.token_type,
                SpanCostDetail.is_prompt,
            )
        )

        results: dict[Key, list[SpanCostDetailSummaryEntry]] = {}
        async with self._db() as session:
            data = await session.stream(cost_detail_stmt)
            async for (
                root_rowid,
                max_depth,
                token_type,
                is_prompt,
                cost,
                tokens,
            ) in data:
                key = (root_rowid, max_depth)
                if key not in results:
                    results[key] = []
                if token_type is not None and is_prompt is not None:
                    results[key].append(
                        SpanCostDetailSummaryEntry(
                            token_type=token_type,
                            is_prompt=is_prompt,
                            value=CostBreakdown(tokens=tokens, cost=cost),
                        )
                    )

        # Return results in the same order as the input keys
        return [results.get(key, []) for key in keys]
