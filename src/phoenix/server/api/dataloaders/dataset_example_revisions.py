from typing import (
    AsyncContextManager,
    Callable,
    Dict,
    List,
    Optional,
    Tuple,
)

from sqlalchemy import and_, func, or_, select, tuple_
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
        example_and_version_ids = (
            (example_id, version_id) for example_id, version_id in keys if version_id is not None
        )
        example_ids_without_version = (
            example_id for example_id, version_id in keys if version_id is None
        )
        latest_revision_ids = (
            select(func.max(models.DatasetExampleRevision.id))
            .where(
                models.DatasetExampleRevision.dataset_example_id.in_(example_ids_without_version)
            )
            .group_by(models.DatasetExampleRevision.dataset_example_id)
        ).scalar_subquery()
        is_latest_revision_for_example = models.DatasetExampleRevision.id.in_(latest_revision_ids)
        query = select(
            models.DatasetExampleRevision,
            is_latest_revision_for_example,
        ).where(
            and_(
                or_(
                    tuple_(
                        models.DatasetExampleRevision.dataset_example_id,
                        models.DatasetExampleRevision.dataset_version_id,
                    ).in_(example_and_version_ids),
                    is_latest_revision_for_example,
                ),
                models.DatasetExampleRevision.revision_kind != "DELETE",
            )
        )
        results: Dict[Key, Result] = {}
        async with self._db() as session:
            for (
                revision,
                is_latest_revision,
            ) in await session.execute(query):
                orm_revision = DatasetExampleRevision.from_orm_revision(revision)
                results[(revision.dataset_example_id, revision.dataset_version_id)] = orm_revision
                if is_latest_revision:
                    results[(revision.dataset_example_id, None)] = orm_revision

        return [results[key] for key in keys]
