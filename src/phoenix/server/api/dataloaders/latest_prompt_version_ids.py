from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PromptId: TypeAlias = int
Key: TypeAlias = PromptId
Result: TypeAlias = Optional[int]


class LatestPromptVersionIdDataLoader(DataLoader[Key, Result]):
    """
    Dataloader that returns the latest prompt version ID for each prompt.
    This helps avoid N+1 queries when resolving isLatest on multiple PromptVersion objects.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        prompt_ids = list(set(keys))
        # For each prompt, get the max version id (which is the latest)
        subq = (
            select(
                models.PromptVersion.prompt_id,
                func.max(models.PromptVersion.id).label("latest_version_id"),
            )
            .where(models.PromptVersion.prompt_id.in_(prompt_ids))
            .group_by(models.PromptVersion.prompt_id)
        ).subquery()

        stmt = select(subq.c.prompt_id, subq.c.latest_version_id)

        async with self._db() as session:
            result = {
                prompt_id: latest_version_id
                async for prompt_id, latest_version_id in await session.stream(stmt)
            }

        return [result.get(prompt_id) for prompt_id in keys]
