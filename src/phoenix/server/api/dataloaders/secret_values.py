from typing import Iterable, Union

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = str
Result: TypeAlias = bytes | None


class SecretValuesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Union[Result, ValueError]]:
        secret_keys = list(set(keys))
        secret_values: dict[Key, Result] = {}
        stmt = select(models.Secret).where(
            models.Secret.key.in_(secret_keys),
            models.Secret.deleted_at.is_(None),
        )
        async with self._db() as session:
            data = await session.stream_scalars(stmt)
            async for secret in data:
                secret_values[secret.key] = secret.value
        return [secret_values.get(secret_key) for secret_key in keys]
