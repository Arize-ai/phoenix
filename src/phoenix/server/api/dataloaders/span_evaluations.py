from collections import defaultdict
from typing import (
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.Evaluation import SpanEvaluation

Key: TypeAlias = int
Result: TypeAlias = List[SpanEvaluation]


class SpanEvaluationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        span_evaluations_by_id: DefaultDict[Key, Result] = defaultdict(list)
        msa = models.SpanAnnotation
        async with self._db() as session:
            data = await session.stream_scalars(
                select(msa).where(msa.span_rowid.in_(keys)).where(msa.annotator_kind == "LLM")
            )
            async for span_evaluation in data:
                span_evaluations_by_id[span_evaluation.span_rowid].append(
                    SpanEvaluation.from_sql_span_annotation(span_evaluation)
                )
        return [span_evaluations_by_id[key] for key in keys]
