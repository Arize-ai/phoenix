from typing import Optional, Union

from sqlalchemy import Integer, case, func, or_, select, union
from sqlalchemy.sql.expression import literal
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.types import DbSessionFactory

ExampleID: TypeAlias = int
VersionID: TypeAlias = Optional[int]
Key: TypeAlias = tuple[ExampleID, Optional[VersionID]]
Result: TypeAlias = DatasetExampleRevision


class DatasetExampleRevisionsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(
            load_fn=self._load_fn,
            # Setting max_batch_size to prevent the size of the query from getting too large.
            # The maximum number of terms is SQLITE_MAX_COMPOUND_SELECT which defaults to 500.
            # This is needed because of the compound select query below used in transferring
            # the input data to the database. SQLite in fact has better ways to transfer data,
            # but unfortunately they're not made available in sqlalchemy yet.
            max_batch_size=200,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Union[Result, NotFound]]:
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
                    # This query gets the latest `revision_id` for each example:
                    # - If `version_id` is NOT given, it finds the maximum `revision_id`.
                    # - If `version_id` is given, it finds the highest `revision_id` whose
                    #   `version_id` is less than or equal to the one specified.
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
        return [results.get(key, NotFound("Could not find revision.")) for key in keys]
