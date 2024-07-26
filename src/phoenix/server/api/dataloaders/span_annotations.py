from collections import defaultdict
from typing import (
    DefaultDict,
    List,
)

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = List[SpanAnnotation]


class SpanAnnotationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        span_annotations_by_id: DefaultDict[Key, Result] = defaultdict(list)
        msa = models.SpanAnnotation
        async with self._db() as session:
            data = await session.stream_scalars(select(msa).where(msa.span_rowid.in_(keys)))
            async for span_annotation in data:
                span_annotations_by_id[span_annotation.span_rowid].append(
                    to_gql_span_annotation(span_annotation)
                )
        return [span_annotations_by_id[key] for key in keys]
