from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
SpanNoteCount: TypeAlias = int

Key: TypeAlias = SpanRowId
Result: TypeAlias = SpanNoteCount


class SpanNoteCountsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(
                models.SpanAnnotation.span_rowid,
                func.count(models.SpanAnnotation.id),
            )
            .where(
                models.SpanAnnotation.span_rowid.in_(keys),
                models.SpanAnnotation.name == "note",
            )
            .group_by(models.SpanAnnotation.span_rowid)
        )
        async with self._db.read() as session:
            note_counts = {
                span_rowid: note_count
                async for span_rowid, note_count in await session.stream(stmt)
            }
        return [note_counts.get(span_rowid, 0) for span_rowid in keys]
