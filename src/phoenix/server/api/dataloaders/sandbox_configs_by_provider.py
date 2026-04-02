from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ProviderID: TypeAlias = int
Key: TypeAlias = ProviderID
Result: TypeAlias = list[models.SandboxConfig]


class SandboxConfigsByProviderDataLoader(DataLoader[Key, Result]):
    """Batches requests for sandbox configs associated with providers."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        configs_by_provider: dict[Key, list[models.SandboxConfig]] = defaultdict(list)

        async with self._db() as session:
            stmt = (
                select(models.SandboxConfig)
                .where(models.SandboxConfig.sandbox_provider_id.in_(keys))
                .order_by(
                    models.SandboxConfig.name.asc(),
                    models.SandboxConfig.id.asc(),
                )
            )
            for row in await session.scalars(stmt):
                configs_by_provider[row.sandbox_provider_id].append(row)

        return [configs_by_provider.get(key, []) for key in keys]
