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
from phoenix.server.api.types.Evaluation import TraceEvaluation

Key: TypeAlias = int
Result: TypeAlias = List[TraceEvaluation]


class TraceEvaluationsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        trace_evaluations_by_id: DefaultDict[Key, Result] = defaultdict(list)
        mta = models.TraceAnnotation
        async with self._db() as session:
            data = await session.stream_scalars(
                select(mta).where(mta.trace_rowid.in_(keys)).where(mta.annotator_kind == "LLM")
            )
            async for trace_evaluation in data:
                trace_evaluations_by_id[trace_evaluation.trace_rowid].append(
                    TraceEvaluation.from_sql_trace_annotation(trace_evaluation)
                )
        return [trace_evaluations_by_id[key] for key in keys]
