from typing import (
    List,
    Optional,
    Tuple,
    Union,
)

from sqlalchemy import Integer, case, func, literal, or_, select, union
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.types import DbSessionFactory

ExampleID: TypeAlias = int
VersionID: TypeAlias = Optional[int]
Key: TypeAlias = Tuple[ExampleID, Optional[VersionID]]
Result: TypeAlias = DatasetExampleRevision


class DatasetExampleRevisionsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Union[Result, ValueError]]:
        # sqlalchemy has limited SQLite support for VALUES, so use UNION ALL instead.
        # For details, see https://github.com/sqlalchemy/sqlalchemy/issues/7228
        keys_subquery = union(
            *(
                select(
                    literal(example_id, Integer).label("example_id"),
                    literal(version_id, Integer).label("version_id"),
                )
                for example_id, version_id in keys
            )
        ).subquery()
        revision_ids = (
            select(
                keys_subquery.c.example_id,
                keys_subquery.c.version_id,
                func.max(models.DatasetExampleRevision.id).label("revision_id"),
            )
            .select_from(keys_subquery)
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
        return [results.get(key, ValueError("Could not find revision.")) for key in keys]
