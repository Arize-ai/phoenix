from itertools import groupby
from random import randint
from typing import (
    AsyncContextManager,
    Callable,
    Dict,
    List,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

SpanId: TypeAlias = str
Key: TypeAlias = SpanId


class SpanDescendantsDataLoader(DataLoader[Key, List[models.Span]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[List[models.Span]]:
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
            .join(models.Trace)
            .options(contains_eager(models.Span.trace))
            .order_by(descendant_ids.c[root_id_label])
        )
        async with self._db() as session:
            data = await session.execute(stmt)
        if not data:
            return [[] for _ in keys]
        results: Dict[SpanId, List[models.Span]] = {key: [] for key in keys}
        for root_id, group in groupby(data, key=lambda d: d[0]):
            results[root_id].extend(span for _, span in group)
        return [results[key].copy() for key in keys]
