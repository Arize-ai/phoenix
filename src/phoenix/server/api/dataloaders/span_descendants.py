from random import randint

from aioitertools.itertools import groupby
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanId: TypeAlias = str

Key: TypeAlias = SpanId
Result: TypeAlias = list[models.Span]


class SpanDescendantsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        root_ids = set(keys)
        root_id_label = f"root_id_{randint(0, 10**6):06}"
        descendant_ids = (
            select(
                models.Span.id,
                models.Span.span_id,
                models.Span.parent_id.label(root_id_label),
            )
            .where(models.Span.parent_id.in_(root_ids))
            .cte(recursive=True)
        )
        parent_ids = descendant_ids.alias()
        descendant_ids = descendant_ids.union_all(
            select(
                models.Span.id,
                models.Span.span_id,
                parent_ids.c[root_id_label],
            ).join(
                parent_ids,
                models.Span.parent_id == parent_ids.c.span_id,
            )
        )
        stmt = (
            select(descendant_ids.c[root_id_label], models.Span)
            .join(descendant_ids, models.Span.id == descendant_ids.c.id)
            .options(joinedload(models.Span.trace, innerjoin=True).load_only(models.Trace.trace_id))
            .order_by(descendant_ids.c[root_id_label])
        )
        results: dict[SpanId, Result] = {key: [] for key in keys}
        async with self._db() as session:
            data = await session.stream(stmt)
            async for root_id, group in groupby(data, key=lambda d: d[0]):
                results[root_id].extend(span for _, span in group)
        return [results[key].copy() for key in keys]
