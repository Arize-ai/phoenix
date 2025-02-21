from secrets import token_hex
from typing import Iterable

from aioitertools.itertools import groupby
from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int

Key: TypeAlias = SpanRowId
Result: TypeAlias = list[SpanRowId]


class SpanDescendantsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        root_ids = (
            select(
                models.Span.span_id,
                models.Span.id,
            )
            .where(models.Span.id.in_(set(keys)))
            .subquery()
        )
        root_id_label = f"root_id_{token_hex(8)}"
        root_rowid_label = f"root_rowid_{token_hex(8)}"
        descendant_ids = (
            select(
                models.Span.id,
                models.Span.span_id,
                models.Span.parent_id.label(root_id_label),
                root_ids.c.id.label(root_rowid_label),
            )
            .join(root_ids, models.Span.parent_id == root_ids.c.span_id)
            .cte(recursive=True)
        )
        parent_ids = descendant_ids.alias()
        descendant_ids = descendant_ids.union_all(
            select(
                models.Span.id,
                models.Span.span_id,
                parent_ids.c[root_id_label],
                parent_ids.c[root_rowid_label],
            ).join(
                parent_ids,
                models.Span.parent_id == parent_ids.c.span_id,
            )
        )
        stmt = (
            select(descendant_ids.c[root_rowid_label], models.Span.id)
            .join(descendant_ids, models.Span.id == descendant_ids.c.id)
            .order_by(descendant_ids.c[root_rowid_label])
        )
        results: dict[Key, Result] = {key: [] for key in keys}
        async with self._db() as session:
            data = await session.stream(stmt)
            async for key, group in groupby(data, key=lambda d: d[0]):
                results[key].extend(span_rowid for _, span_rowid in group)
        return [results[key].copy() for key in keys]
