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
        # Create a values expression with Span.id and respective max_depth (which can be None)
        values = sa.values(
            sa.Column(_ROOT_ROWID, sa.Integer),
            sa.Column(_MAX_DEPTH, sa.Integer, nullable=True),
            name="values",
        ).data(list(set(keys)))

        # Get the root spans with their depth limits
        roots = (
            select(
                Span.span_id,
                values.c[_ROOT_ROWID],
                values.c[_MAX_DEPTH],
            )
            .join_from(values, Span, Span.id == values.c[_ROOT_ROWID])
            .subquery("roots")
        )

        # Initialize the recursive CTE with a level column and max_depth
        descendants = (
            select(
                Span.id,
                Span.span_id,
                roots.c[_ROOT_ROWID],
                roots.c[_MAX_DEPTH],
                sa.literal(1).label(_LEVEL),  # Start at level 1
            )
            .join_from(roots, Span, Span.parent_id == roots.c.span_id)
            .cte("descendants", recursive=True)
        )

        # Build the recursive query
        parents = descendants.alias("parents")
        descendants = descendants.union_all(
            select(
                Span.id,
                Span.span_id,
                parents.c[_ROOT_ROWID],
                parents.c[_MAX_DEPTH],
                (parents.c[_LEVEL] + 1).label(_LEVEL),
            )
            .join_from(parents, Span, Span.parent_id == parents.c.span_id)
            .where(
                sa.or_(
                    parents.c[_MAX_DEPTH].is_(None),  # No limit if max_depth is NULL
                    parents.c[_LEVEL] + 1 <= sa.cast(parents.c[_MAX_DEPTH], sa.Integer),
                ),
            )
        )

        stmt = select(
            descendants.c.id,
            descendants.c[_ROOT_ROWID],
            descendants.c[_MAX_DEPTH],
        ).order_by(
            descendants.c[_ROOT_ROWID],
            descendants.c[_MAX_DEPTH],
            descendants.c[_LEVEL],  # Order by level for BFS
            descendants.c.id,
        )
        results: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for key, group in groupby(data, key=lambda d: tuple(d[1:])):
                results[key].extend(span_rowid for span_rowid, *_ in group)
        return [results[key].copy() for key in keys]


_ROOT_ROWID = "_root_rowid"
_MAX_DEPTH = "_max_depth"
_LEVEL = "_level"
