from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = list[models.DocumentAnnotation]


class DocumentEvaluationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        document_annotations_by_id: defaultdict[Key, Result] = defaultdict(list)
        mda = models.DocumentAnnotation
        async with self._db() as session:
            data = await session.stream_scalars(select(mda).where(mda.span_rowid.in_(keys)))
            async for document_evaluation in data:
                document_annotations_by_id[document_evaluation.span_rowid].append(
                    document_evaluation
                )
        return [document_annotations_by_id[key] for key in keys]
