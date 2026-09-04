from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptLabelID: TypeAlias = int
UsageCount: TypeAlias = int
Key: TypeAlias = PromptLabelID
Result: TypeAlias = UsageCount


class PromptLabelUsageCountsDataLoader(DataLoader[Key, Result]):
    """Batches per-label counts of how many prompts reference each prompt label."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        prompt_label_ids = keys
        query = (
            select(
                models.PromptPromptLabel.prompt_label_id,
                func.count(models.PromptPromptLabel.prompt_id),
            )
            .where(models.PromptPromptLabel.prompt_label_id.in_(set(prompt_label_ids)))
            .group_by(models.PromptPromptLabel.prompt_label_id)
        )
        async with self._db.read() as session:
            counts = {
                prompt_label_id: usage_count
                async for prompt_label_id, usage_count in await session.stream(query)
            }
        return [counts.get(prompt_label_id, 0) for prompt_label_id in keys]
