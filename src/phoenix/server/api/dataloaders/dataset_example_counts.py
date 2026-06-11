from collections import defaultdict
from typing import Optional

from sqlalchemy import Select, func, select
from sqlalchemy.sql.functions import count
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetId: TypeAlias = int
VersionId: TypeAlias = Optional[int]
SplitIds: TypeAlias = tuple[int, ...]  # empty means no split filter
Key: TypeAlias = tuple[DatasetId, VersionId, SplitIds]
Result: TypeAlias = int


class DatasetExampleCountsDataLoader(DataLoader[Key, Result]):
    """Batches dataset example-count lookups to avoid one session per dataset."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        groups: defaultdict[tuple[VersionId, SplitIds], set[DatasetId]] = defaultdict(set)
        for dataset_id, version_id, split_ids in keys:
            groups[(version_id, split_ids)].add(dataset_id)
        version_ids = {version_id for version_id, _ in groups if version_id is not None}
        counts: dict[Key, int] = {}
        async with self._db.read() as session:
            version_owners: dict[int, int] = {}
            if version_ids:
                version_owners = {
                    version_id: dataset_id
                    for version_id, dataset_id in await session.execute(
                        select(models.DatasetVersion.id, models.DatasetVersion.dataset_id).where(
                            models.DatasetVersion.id.in_(version_ids)
                        )
                    )
                }
            for (version_id, split_ids), dataset_ids in groups.items():
                target_dataset_ids = dataset_ids
                if version_id is not None:
                    # A version belongs to exactly one dataset; any other dataset
                    # queried with this version has zero examples in it.
                    target_dataset_ids = {
                        dataset_id
                        for dataset_id in dataset_ids
                        if dataset_id == version_owners.get(version_id)
                    }
                if not target_dataset_ids:
                    continue
                stmt = _count_statement(target_dataset_ids, version_id, split_ids)
                for dataset_id, example_count in await session.execute(stmt):
                    counts[(dataset_id, version_id, split_ids)] = example_count
        return [counts.get(key, 0) for key in keys]


def _count_statement(
    dataset_ids: set[DatasetId],
    version_id: VersionId,
    split_ids: SplitIds,
) -> Select[tuple[int, int]]:
    revision_ids = (
        select(func.max(models.DatasetExampleRevision.id))
        .join(models.DatasetExample)
        .where(models.DatasetExample.dataset_id.in_(dataset_ids))
        .group_by(models.DatasetExampleRevision.dataset_example_id)
    )
    if version_id is not None:
        revision_ids = revision_ids.where(
            models.DatasetExampleRevision.dataset_version_id <= version_id
        )
    if split_ids:
        stmt = (
            select(
                models.DatasetExample.dataset_id,
                count(models.DatasetExample.id.distinct()),
            )
            .join(
                models.DatasetExampleRevision,
                onclause=(
                    models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id
                ),
            )
            .join(
                models.DatasetSplitDatasetExample,
                onclause=(
                    models.DatasetExample.id == models.DatasetSplitDatasetExample.dataset_example_id
                ),
            )
            .where(models.DatasetSplitDatasetExample.dataset_split_id.in_(split_ids))
        )
    else:
        stmt = select(
            models.DatasetExample.dataset_id,
            count(models.DatasetExampleRevision.id),
        ).join(
            models.DatasetExampleRevision,
            onclause=(models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id),
        )
    return (
        stmt.where(models.DatasetExampleRevision.id.in_(revision_ids))
        .where(models.DatasetExampleRevision.revision_kind != "DELETE")
        .group_by(models.DatasetExample.dataset_id)
    )
