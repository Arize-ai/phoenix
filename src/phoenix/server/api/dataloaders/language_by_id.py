from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

LanguageId: TypeAlias = int
Key: TypeAlias = LanguageId
Result: TypeAlias = Optional[models.Language]


class LanguageByIdDataLoader(DataLoader[Key, Result]):
    """Batches requests for languages by their primary key."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        language_ids = list(set(keys))
        languages_by_id: dict[Key, models.Language] = {}

        async with self._db() as session:
            data = await session.stream_scalars(
                select(models.Language).where(models.Language.id.in_(language_ids))
            )
            async for language in data:
                languages_by_id[language.id] = language

        return [languages_by_id.get(key) for key in keys]
