from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SandboxProviderId: TypeAlias = int
Key: TypeAlias = SandboxProviderId
Result: TypeAlias = Optional[models.SandboxProvider]


class SandboxProviderByIdDataLoader(DataLoader[Key, Result]):
    """Batches requests for sandbox providers by their primary key."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        provider_ids = list(set(keys))
        providers_by_id: dict[Key, models.SandboxProvider] = {}

        async with self._db() as session:
            data = await session.stream_scalars(
                select(models.SandboxProvider).where(models.SandboxProvider.id.in_(provider_ids))
            )
            async for provider in data:
                providers_by_id[provider.id] = provider

        return [providers_by_id.get(key) for key in keys]
