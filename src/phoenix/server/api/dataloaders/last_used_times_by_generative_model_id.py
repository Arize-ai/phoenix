from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

GenerativeModelID: TypeAlias = int
Key: TypeAlias = GenerativeModelID
Result: TypeAlias = Optional[datetime]


class LastUsedTimesByGenerativeModelIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        async with self._db() as session:
            last_used_times_by_model_id: dict[Key, Result] = {
                model_id: last_used_time
                async for model_id, last_used_time in await session.stream(
                    select(
                        models.SpanCost.model_id,
                        func.max(models.SpanCost.span_start_time).label("last_used_time"),
                    )
                    .select_from(models.SpanCost)
                    .where(models.SpanCost.model_id.in_(keys))
                    .group_by(models.SpanCost.model_id)
                )
            }
        return [last_used_times_by_model_id.get(model_id) for model_id in keys]
