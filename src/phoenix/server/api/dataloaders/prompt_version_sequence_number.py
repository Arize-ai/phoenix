from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptVersionId: TypeAlias = int
Key: TypeAlias = PromptVersionId
Result: TypeAlias = Optional[int]


class PromptVersionSequenceNumberDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        prompt_version_ids = keys
        row_number = (
            func.row_number().over(
                partition_by=models.PromptVersion.prompt_id,
                order_by=models.PromptVersion.id,
            )
        ).label("sequence_number")
        subq = select(models.PromptVersion.id.label("prompt_version_id"), row_number).subquery()
        stmt = select(subq).where(subq.c.prompt_version_id.in_(prompt_version_ids))
        async with self._db() as session:
            result = {
                prompt_version_id: seq_number
                async for prompt_version_id, seq_number in await session.stream(stmt)
            }
        return [result.get(prompt_version_id) for prompt_version_id in keys]
