from collections import defaultdict
from secrets import token_hex
from typing import Iterable, Optional

import sqlalchemy as sa
from aioitertools.itertools import groupby
from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
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
        root_rowid_label = f"_root_rowid_{token_hex(2)}"
        max_depth_label = f"_max_depth_{token_hex(2)}"
        level_label = f"_level_{token_hex(2)}"

        # Create a values expression with Span.id and respective max_depth (which can be None)
        id_depth = (
            sa.values(
                sa.Column("id", sa.Integer),
                sa.Column("max_depth", sa.Integer, nullable=True),
                name="id_depth",
            )
            .data(list(set(keys)))
            .alias("id_depth")
        )

        # Get the root spans with their depth limits
        roots = (
            select(
                models.Span.span_id,
                id_depth.c.id.label(root_rowid_label),
                id_depth.c.max_depth.label(max_depth_label),
            )
            .join(id_depth, models.Span.id == id_depth.c.id)
            .subquery("roots")
        )

        # Initialize the recursive CTE with a level column and max_depth
        descendants = (
            select(
                models.Span.id,
                models.Span.span_id,
                roots.c[root_rowid_label],
                roots.c[max_depth_label],
                sa.literal(1).label(level_label),  # Start at level 1
            )
            .join_from(roots, models.Span, models.Span.parent_id == roots.c.span_id)
            .cte("descendants", recursive=True)
        )

        # Build the recursive query
        parents = descendants.alias("parents")
        descendants = descendants.union_all(
            select(
                models.Span.id,
                models.Span.span_id,
                parents.c[root_rowid_label],
                parents.c[max_depth_label],
                (parents.c[level_label] + 1).label(level_label),
            )
            .join_from(parents, models.Span, models.Span.parent_id == parents.c.span_id)
            .where(
                sa.or_(
                    parents.c[max_depth_label].is_(None),  # No limit if max_depth is NULL
                    parents.c[level_label] + 1 <= sa.cast(parents.c[max_depth_label], sa.Integer),
                ),
            )
        )

        stmt = select(
            descendants.c.id,
            descendants.c[root_rowid_label],
            descendants.c[max_depth_label],
        ).order_by(
            descendants.c[root_rowid_label],
            descendants.c[max_depth_label],
            descendants.c[level_label],  # Order by level for BFS
            descendants.c.id,
        )
        results: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for key, group in groupby(data, key=lambda d: tuple(d[1:])):
                results[key].extend(span_rowid for span_rowid, *_ in group)
        return [results[key].copy() for key in keys]
