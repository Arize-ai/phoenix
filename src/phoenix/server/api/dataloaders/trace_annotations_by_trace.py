from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import TraceAnnotation
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
Key: TypeAlias = TraceRowId
Result: TypeAlias = list[TraceAnnotation]


class TraceAnnotationsByTraceDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        annotations_by_id: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for annotation in await session.stream_scalars(
                select(TraceAnnotation).where(TraceAnnotation.trace_rowid.in_(keys))
            ):
                annotations_by_id[annotation.trace_rowid].append(annotation)
        return [annotations_by_id[key] for key in keys]
