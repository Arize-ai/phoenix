from collections import defaultdict
from typing import Iterable, Optional

import sqlalchemy as sa
from aioitertools.itertools import groupby
from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
MaxDepth: TypeAlias = int

Key: TypeAlias = tuple[SpanRowId, Optional[MaxDepth]]
Result: TypeAlias = list[SpanRowId]


class SpanDescendantsDataLoader(DataLoader[Key, Result]):
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

        # Initialize the recursive common table expression (CTE) with direct children
        # of root spans, setting depth=1.
        descendants = (
            select(
                Span.id,
                Span.span_id,
                Span.start_time,
                roots.c.root_rowid,
                roots.c.max_depth,
                sa.literal(1).label("depth"),  # immediate children are depth=1 from root
            )
            .join_from(roots, Span, Span.parent_id == roots.c.span_id)
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

        # Final query to select and order all descendants.
        # Ordering ensures breadth-first traversal and consistent results.
        stmt = select(
            descendants.c.id,
            descendants.c.root_rowid,
            descendants.c.max_depth,
        ).order_by(
            descendants.c.root_rowid,
            descendants.c.max_depth,
            descendants.c.depth,  # Order by depth for BFS traversal
            descendants.c.start_time,
            descendants.c.id,
        )

        results: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            # Group results by root_rowid and max_depth (the Key tuple)
            async for key, group in groupby(data, key=lambda d: tuple(d[1:])):
                # Extract span IDs (the database row IDs) and add them to the result list.
                # The first column (index 0) from our query is Span.id.
                results[key].extend(id_ for id_, *_ in group)

        return [results[key].copy() for key in keys]
