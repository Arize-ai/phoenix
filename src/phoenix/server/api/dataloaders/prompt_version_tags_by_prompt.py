from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptId: TypeAlias = int
Key: TypeAlias = PromptId
Result: TypeAlias = list[models.PromptVersionTag]


class PromptVersionTagsByPromptDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        prompt_ids = list(set(keys))
        tags: dict[Key, Result] = {}
        stmt = (
            select(models.PromptVersionTag)
            .where(models.PromptVersionTag.prompt_id.in_(prompt_ids))
            .order_by(models.PromptVersionTag.id)
        )
        async with self._db.read() as session:
            async for tag in await session.stream_scalars(stmt):
                tags.setdefault(tag.prompt_id, []).append(tag)
        return [tags.get(prompt_id, []) for prompt_id in keys]
