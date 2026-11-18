from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.types.model_provider import ProviderModels
from phoenix.server.types import DbSessionFactory

ProviderId: TypeAlias = int
Key: TypeAlias = ProviderId
Result: TypeAlias = ProviderModels


class CustomProviderModelsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        rows_by_provider: defaultdict[Key, list[models.CustomProviderModelType]] = defaultdict(list)
        stmt = select(models.CustomProviderModelType).where(
            models.CustomProviderModelType.provider_id.in_(set(keys))
        )
        async with self._db.read() as session:
            for row in await session.scalars(stmt):
                rows_by_provider[row.provider_id].append(row)
        return [models.provider_models_from_rows(rows_by_provider[key]) for key in keys]
