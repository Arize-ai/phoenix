from collections import defaultdict
from typing import (
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
)

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.Evaluation import DocumentEvaluation

Key: TypeAlias = int


class DocumentEvaluationsDataLoader(DataLoader[Key, List[DocumentEvaluation]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[List[DocumentEvaluation]]:
        document_evaluations_by_id: DefaultDict[Key, List[DocumentEvaluation]] = defaultdict(list)
        async with self._db() as session:
            for document_evaluation in await session.scalars(
                select(models.DocumentAnnotation).where(
                    and_(
                        models.DocumentAnnotation.span_rowid.in_(keys),
                        models.DocumentAnnotation.annotator_kind == "LLM",
                    )
                )
            ):
                document_evaluations_by_id[document_evaluation.span_rowid].append(
                    DocumentEvaluation.from_sql_document_annotation(document_evaluation)
                )
        return [document_evaluations_by_id[key] for key in keys]
