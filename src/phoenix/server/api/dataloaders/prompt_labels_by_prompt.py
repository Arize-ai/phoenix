from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptId: TypeAlias = int
Key: TypeAlias = PromptId
Result: TypeAlias = list[models.PromptLabel]


class PromptLabelsByPromptDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        prompt_ids = list(set(keys))
        labels: dict[Key, Result] = {}
        stmt = (
            select(models.PromptPromptLabel.prompt_id, models.PromptLabel)
            .join_from(models.PromptPromptLabel, models.PromptLabel)
            .where(models.PromptPromptLabel.prompt_id.in_(prompt_ids))
            .order_by(models.PromptLabel.id)
        )
        async with self._db.read() as session:
            async for prompt_id, label in await session.stream(stmt):
                labels.setdefault(prompt_id, []).append(label)
        return [labels.get(prompt_id, []) for prompt_id in keys]
