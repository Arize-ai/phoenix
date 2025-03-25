from collections import defaultdict

from sqlalchemy import or_, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.models import Project
from phoenix.server.types import DbSessionFactory

PolicyRowId: TypeAlias = int
ProjectRowId: TypeAlias = int

Key: TypeAlias = PolicyRowId
Result: TypeAlias = list[ProjectRowId]


class ProjectIdsByTraceRetentionPolicyIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        ids = set(keys)
        stmt = select(Project.trace_retention_policy_id, Project.id)
        if DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID in ids:
            stmt = stmt.where(
                or_(
                    Project.trace_retention_policy_id.in_(ids),
                    Project.trace_retention_policy_id.is_(None),
                )
            )
        else:
            stmt = stmt.where(Project.trace_retention_policy_id.in_(ids))
        projects: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for policy_rowid, project_rowid in data:
                projects[policy_rowid or DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID].append(
                    project_rowid
                )
        return [projects.get(project_name, []).copy() for project_name in keys]
