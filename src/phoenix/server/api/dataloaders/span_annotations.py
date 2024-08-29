from collections import defaultdict
from typing import (
    DefaultDict,
    List,
)

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import SpanAnnotation as ORMSpanAnnotation
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = List[ORMSpanAnnotation]


class SpanAnnotationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        span_annotations_by_id: DefaultDict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for span_annotation in await session.stream_scalars(
                select(ORMSpanAnnotation).where(ORMSpanAnnotation.span_rowid.in_(keys))
            ):
                span_annotations_by_id[span_annotation.span_rowid].append(span_annotation)
        return [span_annotations_by_id[key] for key in keys]
