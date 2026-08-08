from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptId: TypeAlias = int
Key: TypeAlias = PromptId
Result: TypeAlias = int


class PromptVersionCountDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        prompt_ids = list(set(keys))
        result: dict[Key, Result] = {}
        stmt = (
            select(
                models.PromptVersion.prompt_id,
                func.count(),
            )
            .where(models.PromptVersion.prompt_id.in_(prompt_ids))
            .group_by(models.PromptVersion.prompt_id)
        )
        async with self._db.read() as session:
            data = await session.stream(stmt)
            async for prompt_id, count in data:
                result[prompt_id] = count
        return [result.get(prompt_id, 0) for prompt_id in keys]
