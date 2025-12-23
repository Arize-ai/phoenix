from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SecretKey: TypeAlias = str
Key: TypeAlias = SecretKey
Result: TypeAlias = Optional[models.Secret]


class SecretsDataLoader(DataLoader[Key, Result]):
    """DataLoader that batches together secrets by their keys."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        secret_keys = set(keys)
        secrets_by_key: defaultdict[Key, Result] = defaultdict(None)
        async with self._db() as session:
            data = await session.stream_scalars(
                select(models.Secret).where(models.Secret.key.in_(secret_keys))
            )
            async for secret in data:
                secrets_by_key[secret.key] = secret
        return [secrets_by_key.get(secret_key) for secret_key in keys]
