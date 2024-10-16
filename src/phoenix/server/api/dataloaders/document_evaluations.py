from collections import defaultdict
from typing import (
    DefaultDict,
    List,
)

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.Evaluation import DocumentEvaluation
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = List[DocumentEvaluation]


class DocumentEvaluationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        document_evaluations_by_id: DefaultDict[Key, Result] = defaultdict(list)
        mda = models.DocumentAnnotation
        async with self._db() as session:
            data = await session.stream_scalars(
                select(mda).where(mda.span_rowid.in_(keys)).where(mda.annotator_kind == "LLM")
            )
            async for document_evaluation in data:
                document_evaluations_by_id[document_evaluation.span_rowid].append(
                    DocumentEvaluation.from_sql_document_annotation(document_evaluation)
                )
        return [document_evaluations_by_id[key] for key in keys]
