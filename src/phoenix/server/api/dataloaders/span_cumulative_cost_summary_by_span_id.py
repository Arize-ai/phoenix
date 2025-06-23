from typing import Iterable, Optional

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span, SpanCost
from phoenix.server.api.dataloaders.types import CostBreakdown, SpanCostSummary
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
MaxDepth: TypeAlias = int

Key: TypeAlias = tuple[SpanRowId, Optional[MaxDepth]]
Result: TypeAlias = SpanCostSummary


class SpanCumulativeCostSummaryBySpanIdDataLoader(DataLoader[Key, Result]):
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

        # Now join with span_costs to get the cost data for all descendant spans
        cost_stmt = (
            select(
                descendants.c.root_rowid,
                descendants.c.max_depth,
                coalesce(func.sum(SpanCost.prompt_cost), 0).label("prompt_cost"),
                coalesce(func.sum(SpanCost.completion_cost), 0).label("completion_cost"),
                coalesce(func.sum(SpanCost.total_cost), 0).label("total_cost"),
                coalesce(func.sum(SpanCost.prompt_tokens), 0).label("prompt_tokens"),
                coalesce(func.sum(SpanCost.completion_tokens), 0).label("completion_tokens"),
                coalesce(func.sum(SpanCost.total_tokens), 0).label("total_tokens"),
            )
            .select_from(descendants)
            .outerjoin(SpanCost, SpanCost.span_rowid == descendants.c.id)
            .group_by(descendants.c.root_rowid, descendants.c.max_depth)
        )

        results: dict[Key, Result] = {}
        async with self._db() as session:
            data = await session.stream(cost_stmt)
            async for (
                root_rowid,
                max_depth,
                prompt_cost,
                completion_cost,
                total_cost,
                prompt_tokens,
                completion_tokens,
                total_tokens,
            ) in data:
                key = (root_rowid, max_depth)
                results[key] = SpanCostSummary(
                    prompt=CostBreakdown(tokens=prompt_tokens, cost=prompt_cost),
                    completion=CostBreakdown(tokens=completion_tokens, cost=completion_cost),
                    total=CostBreakdown(tokens=total_tokens, cost=total_cost),
                )

        # Return results in the same order as the input keys
        return [results.get(key, SpanCostSummary()) for key in keys]
