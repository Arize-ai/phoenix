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
from phoenix.server.api.types.Evaluation import TraceEvaluation

Key: TypeAlias = int


class TraceEvaluationsDataLoader(DataLoader[Key, List[TraceEvaluation]]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[List[TraceEvaluation]]:
        trace_evaluations_by_id: DefaultDict[Key, List[TraceEvaluation]] = defaultdict(list)
        async with self._db() as session:
            for trace_evaluation in await session.scalars(
                select(models.TraceAnnotation).where(
                    and_(
                        models.TraceAnnotation.trace_rowid.in_(keys),
                        models.TraceAnnotation.annotator_kind == "LLM",
                    )
                )
            ):
                trace_evaluations_by_id[trace_evaluation.trace_rowid].append(
                    TraceEvaluation.from_sql_trace_annotation(trace_evaluation)
                )
        return [trace_evaluations_by_id[key] for key in keys]
