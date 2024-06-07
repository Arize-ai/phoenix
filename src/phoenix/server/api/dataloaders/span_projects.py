from typing import AsyncContextManager, Callable, List, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

SpanID: TypeAlias = int
Key: TypeAlias = SpanID
Result: TypeAlias = models.Project


class SpanProjectsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Union[Result, ValueError]]:
        span_ids = list(set(keys))
        async with self._db() as session:
            projects = {
                span_id: project
                async for span_id, project in await session.stream(
                    select(models.Span.id, models.Project)
                    .select_from(models.Span)
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .join(models.Project, models.Trace.project_rowid == models.Project.id)
                    .where(models.Span.id.in_(span_ids))
                )
            }
        return [projects.get(span_id) or ValueError("Invalid span ID") for span_id in span_ids]
