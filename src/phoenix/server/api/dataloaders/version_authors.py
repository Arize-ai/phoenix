from typing import Generic, NamedTuple, Optional, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import QueryableAttribute, aliased
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ParentId: TypeAlias = int
Key: TypeAlias = ParentId

VersionTable = TypeVar("VersionTable", models.PromptVersion, models.DatasetVersion)


class VersionAuthors(NamedTuple):
    created_by: Optional[models.User]
    updated_by: Optional[models.User]


Result: TypeAlias = VersionAuthors

_EMPTY = VersionAuthors(created_by=None, updated_by=None)


class VersionAuthorsDataLoader(DataLoader[Key, Result], Generic[VersionTable]):
    """
    Dataloader that returns, for each versioned record, the user who authored its first version and
    the user who authored its latest version. Records such as prompts have no author of their own:
    authorship lives on their versions, so the creator is the author of the earliest version and the
    last editor is the author of the latest one.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        version_table: type[VersionTable],
        parent_id_column: QueryableAttribute[int],
        resolve_created_by: bool = True,
    ) -> None:
        """
        Set `resolve_created_by` to False for parents that carry their own creator (a dataset
        owns a user_id), so the query skips the first-version join it would never be asked for.
        """
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._version_table: type[VersionTable] = version_table
        self._parent_id_column = parent_id_column
        self._resolve_created_by = resolve_created_by

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        parent_ids = list(set(keys))
        version_table = self._version_table
        parent_id_column = self._parent_id_column
        resolve_created_by = self._resolve_created_by
        # Version ids are monotonic per parent, so min/max identify the first and latest versions.
        bound_columns = [func.max(version_table.id).label("latest_version_id")]
        if resolve_created_by:
            bound_columns.append(func.min(version_table.id).label("first_version_id"))
        version_bounds = (
            select(parent_id_column.label("parent_id"), *bound_columns)
            .where(parent_id_column.in_(parent_ids))
            .group_by(parent_id_column)
        ).subquery()

        # Join the users in so the resolved User carries its record and needs no further query.
        latest_version = aliased(version_table)
        updated_by = aliased(models.User)
        stmt = (
            select(version_bounds.c.parent_id, updated_by)
            .join(latest_version, latest_version.id == version_bounds.c.latest_version_id)
            .outerjoin(updated_by, updated_by.id == latest_version.user_id)
        )
        if resolve_created_by:
            first_version = aliased(version_table)
            created_by = aliased(models.User)
            stmt = (
                stmt.add_columns(created_by)
                .join(first_version, first_version.id == version_bounds.c.first_version_id)
                .outerjoin(created_by, created_by.id == first_version.user_id)
            )

        async with self._db.read() as session:
            results = {
                row.parent_id: VersionAuthors(
                    created_by=row[2] if resolve_created_by else None,
                    updated_by=row[1],
                )
                async for row in await session.stream(stmt)
            }

        return [results.get(parent_id, _EMPTY) for parent_id in keys]
