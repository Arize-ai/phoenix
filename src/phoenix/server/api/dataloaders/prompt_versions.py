from typing import Optional, Union

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[models.PromptVersion]


class PromptVersionDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Union[Result, ValueError]]:
        prompt_version_ids = list(set(keys))
        versions: dict[Key, models.PromptVersion] = {}
        stmt = select(models.PromptVersion).where(models.PromptVersion.id.in_(prompt_version_ids))
        async with self._db.read() as session:
            async for version in await session.stream_scalars(stmt):
                versions[version.id] = version
        return [versions.get(key) for key in keys]
