from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ProjectId: TypeAlias = int
Key: TypeAlias = ProjectId
Result: TypeAlias = tuple[models.AnnotationConfig, ...]


class AnnotationConfigsByProjectDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(models.ProjectAnnotationConfig.project_id, models.AnnotationConfig)
            .join_from(models.ProjectAnnotationConfig, models.AnnotationConfig)
            .where(models.ProjectAnnotationConfig.project_id.in_(keys))
        )
        results: defaultdict[Key, list[models.AnnotationConfig]] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for id_, config in data:
                results[id_].append(config)
        return [tuple(results[k]) for k in keys]
