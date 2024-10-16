from typing import (
    List,
    Optional,
    Tuple,
    Union,
)

from sqlalchemy import and_, case, func, null, or_, select
from sqlalchemy.sql.expression import literal
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.types import DbSessionFactory

ExampleID: TypeAlias = int
VersionID: TypeAlias = Optional[int]
Key: TypeAlias = Tuple[ExampleID, Optional[VersionID]]
Result: TypeAlias = DatasetExampleRevision


class DatasetExampleRevisionsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(
            load_fn=self._load_fn,
            max_batch_size=200,  # needed to prevent the size of the query from getting too large
        )
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Union[Result, NotFound]]:
        example_and_version_ids = tuple(
            set(
                (example_id, version_id)
                for example_id, version_id in keys
                if version_id is not None
            )
        )
        versionless_example_ids = tuple(
            set(example_id for example_id, version_id in keys if version_id is None)
        )
        resolved_example_and_version_ids = (
            (
                select(
                    models.DatasetExample.id.label("example_id"),
                    models.DatasetVersion.id.label("version_id"),
                )
                .select_from(models.DatasetExample)
                .join(
                    models.DatasetVersion,
                    onclause=literal(True),  # cross join
                )
                .where(
                    or_(
                        *(
                            and_(
                                models.DatasetExample.id == example_id,
                                models.DatasetVersion.id == version_id,
                            )
                            for example_id, version_id in example_and_version_ids
                        )
                    )
                )
            )
            .union(
                select(
                    models.DatasetExample.id.label("example_id"), null().label("version_id")
                ).where(models.DatasetExample.id.in_(versionless_example_ids))
            )
            .subquery()
        )
        revision_ids = (
            select(
                resolved_example_and_version_ids.c.example_id,
                resolved_example_and_version_ids.c.version_id,
                func.max(models.DatasetExampleRevision.id).label("revision_id"),
            )
            .select_from(resolved_example_and_version_ids)
            .join(
                models.DatasetExampleRevision,
                onclause=resolved_example_and_version_ids.c.example_id
                == models.DatasetExampleRevision.dataset_example_id,
            )
            .where(
                or_(
                    resolved_example_and_version_ids.c.version_id.is_(None),
                    models.DatasetExampleRevision.dataset_version_id
                    <= resolved_example_and_version_ids.c.version_id,
                )
            )
            .group_by(
                resolved_example_and_version_ids.c.example_id,
                resolved_example_and_version_ids.c.version_id,
            )
        ).subquery()
        query = (
            select(
                revision_ids.c.example_id,
                revision_ids.c.version_id,
                case(
                    (
                        or_(
                            revision_ids.c.version_id.is_(None),
                            models.DatasetVersion.id.is_not(None),
                        ),
                        True,
                    ),
                    else_=False,
                ).label("is_valid_version"),  # check that non-null versions exist
                models.DatasetExampleRevision,
            )
            .select_from(revision_ids)
            .join(
                models.DatasetExampleRevision,
                onclause=revision_ids.c.revision_id == models.DatasetExampleRevision.id,
            )
            .join(
                models.DatasetVersion,
                onclause=revision_ids.c.version_id == models.DatasetVersion.id,
                isouter=True,  # keep rows where the version id is null
            )
            .where(models.DatasetExampleRevision.revision_kind != "DELETE")
        )
        async with self._db() as session:
            results = {
                (example_id, version_id): DatasetExampleRevision.from_orm_revision(revision)
                async for (
                    example_id,
                    version_id,
                    is_valid_version,
                    revision,
                ) in await session.stream(query)
                if is_valid_version
            }
        return [results.get(key, NotFound("Could not find revision.")) for key in keys]
