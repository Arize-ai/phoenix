from sqlalchemy import distinct, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int  # project rowid
Result: TypeAlias = bool


class ProjectIsEvaluatorTraceTargetDataLoader(DataLoader[Key, Result]):
    """Whether a project is where some project evaluator's own traces land.

    The row-side counterpart of ``exclude_criteria_targeting_evaluator_traces``:
    a criteria pointed at such a project is dropped by both sweep loads, so the
    schedulability field has to say so rather than advertise an evaluator that
    never runs.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        trace_project_id = models.ProjectEvaluatorCriteria.trace_project_id
        stmt = select(distinct(trace_project_id)).where(trace_project_id.in_(keys))
        async with self._db.read() as session:
            result = set(await session.scalars(stmt))
        return [key in result for key in keys]
