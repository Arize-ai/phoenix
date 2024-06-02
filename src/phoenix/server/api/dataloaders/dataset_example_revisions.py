from typing import (
    AsyncContextManager,
    Callable,
    Dict,
    List,
    Optional,
    Tuple,
)

from sqlalchemy import and_, func, select, tuple_
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
        results: Dict[Key, Result] = {}
        example_and_version_ids = [
            (example_id, version_id) for example_id, version_id in keys if version_id is not None
        ]
        example_ids_without_version_ids = [
            example_id for example_id, version_id in keys if version_id is None
        ]
        async with self._db() as session:
            if example_and_version_ids:
                revisions = await session.stream_scalars(
                    select(models.DatasetExampleRevision).where(
                        and_(
                            tuple_(
                                models.DatasetExampleRevision.dataset_example_id,
                                models.DatasetExampleRevision.dataset_version_id,
                            ).in_(example_and_version_ids),
                            models.DatasetExampleRevision.revision_kind != "DELETE",
                        )
                    )
                )
                results = {
                    (
                        revision.dataset_example_id,
                        revision.dataset_version_id,
                    ): DatasetExampleRevision.from_orm_revision(revision)
                    async for revision in revisions
                }
            if example_ids_without_version_ids:
                revision_ids = (
                    select(func.max(models.DatasetExampleRevision.id))
                    .where(
                        models.DatasetExampleRevision.dataset_example_id.in_(
                            example_ids_without_version_ids
                        )
                    )
                    .group_by(models.DatasetExampleRevision.dataset_example_id)
                ).scalar_subquery()
                revisions = await session.stream_scalars(
                    select(models.DatasetExampleRevision).where(
                        and_(
                            models.DatasetExampleRevision.id.in_(revision_ids),
                            models.DatasetExampleRevision.revision_kind != "DELETE",
                        )
                    )
                )
        if len(results) < len(keys):
            raise ValueError("Could not find revision(s).")
        return [results[key] for key in keys]
