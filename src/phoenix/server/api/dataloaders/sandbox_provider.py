from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SandboxBackendTypeKey: TypeAlias = str
Key: TypeAlias = SandboxBackendTypeKey
Result: TypeAlias = Optional[models.SandboxProvider]


class SandboxProviderDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        kind_set = set(keys)
        providers_by_kind: dict[str, models.SandboxProvider] = {}

        async with self._db() as session:
            data = await session.stream_scalars(
                select(models.SandboxProvider).where(
                    models.SandboxProvider.backend_type.in_(kind_set)
                )
            )
            async for provider in data:
                providers_by_kind[provider.backend_type] = provider

        return [providers_by_kind.get(key) for key in keys]
