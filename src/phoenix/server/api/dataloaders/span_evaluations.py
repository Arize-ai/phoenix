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
from phoenix.server.api.types.Evaluation import SpanEvaluation

Key: TypeAlias = int


class SpanEvaluationsDataLoader(DataLoader[Key, List[SpanEvaluation]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[List[SpanEvaluation]]:
        span_evaluations_by_id: DefaultDict[Key, List[SpanEvaluation]] = defaultdict(list)
        async with self._db() as session:
            for span_evaluation in await session.scalars(
                select(models.SpanAnnotation).where(
                    and_(
                        models.SpanAnnotation.span_rowid.in_(keys),
                        models.SpanAnnotation.annotator_kind == "LLM",
                    )
                )
            ):
                span_evaluations_by_id[span_evaluation.span_rowid].append(
                    SpanEvaluation.from_sql_span_annotation(span_evaluation)
                )
        return [span_evaluations_by_id[key] for key in keys]
