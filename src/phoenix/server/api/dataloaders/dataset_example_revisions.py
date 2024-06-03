from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
    Tuple,
)

from sqlalchemy import Integer, func, literal, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision

ExampleID: TypeAlias = int
VersionID: TypeAlias = Optional[int]
Key: TypeAlias = Tuple[ExampleID, Optional[VersionID]]
Result: TypeAlias = DatasetExampleRevision


class DatasetExampleRevisionsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        keys_subquery = union_all(
            *(
                select(
                    literal(example_id, Integer).label("example_id"),
                    literal(version_id, Integer).label("version_id"),
                )
                for example_id, version_id in keys
            )
        ).subquery()
        latest_revision_ids_per_key = (
            select(
                keys_subquery.c.example_id,
                keys_subquery.c.version_id,
                func.max(models.DatasetExampleRevision.id).label("revision_id"),
            )
            .join(
                models.DatasetExampleRevision,
                onclause=keys_subquery.c.example_id
                == models.DatasetExampleRevision.dataset_example_id,
            )
            .where(
                or_(
                    keys_subquery.c.version_id.is_(None),
                    models.DatasetExampleRevision.dataset_version_id <= keys_subquery.c.version_id,
                )
            )
            .group_by(keys_subquery.c.example_id, keys_subquery.c.version_id)
        ).subquery()
        query = (
            select(
                latest_revision_ids_per_key.c.example_id,
                latest_revision_ids_per_key.c.version_id,
                models.DatasetExampleRevision,
            )
            .select_from(latest_revision_ids_per_key)
            .join(
                models.DatasetExampleRevision,
                onclause=latest_revision_ids_per_key.c.revision_id
                == models.DatasetExampleRevision.id,
            )
            .where(models.DatasetExampleRevision.revision_kind != "DELETE")
        )
        async with self._db() as session:
            results = {
                (example_id, version_id): revision
                async for example_id, version_id, revision in await session.stream(query)
            }
        return [DatasetExampleRevision.from_orm_revision(results[key]) for key in keys]
