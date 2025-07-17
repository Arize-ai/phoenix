from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import SpanAnnotation as ORMSpanAnnotation
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = list[ORMSpanAnnotation]


class SpanAnnotationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        span_annotations_by_id: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for span_annotation in await session.stream_scalars(
                select(ORMSpanAnnotation).where(ORMSpanAnnotation.span_rowid.in_(keys))
            ):
                span_annotations_by_id[span_annotation.span_rowid].append(span_annotation)
        return [span_annotations_by_id[key] for key in keys]
