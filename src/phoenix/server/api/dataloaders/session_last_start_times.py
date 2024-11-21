from datetime import datetime
from typing import Optional

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[datetime]


class SessionLastStartTimeDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(
                models.Trace.project_session_rowid,
                func.max(models.Trace.start_time).label("last_start_time"),
            )
            .where(models.Trace.project_session_rowid.in_(set(keys)))
            .group_by(models.Trace.project_session_rowid)
        )
        async with self._db() as session:
            result: dict[Key, Result] = {
                id_: last_start_time
                async for id_, last_start_time in await session.stream(stmt)
                if id_ is not None
            }
        return [result.get(key) for key in keys]


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
