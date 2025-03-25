from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.models import Project
from phoenix.server.types import DbSessionFactory

PolicyRowId: TypeAlias = int
ProjectRowId: TypeAlias = int

Key: TypeAlias = ProjectRowId
Result: TypeAlias = PolicyRowId


class TraceRetentionPolicyIdByProjectIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        ids = set(keys)
        stmt = (
            select(Project.id, Project.trace_retention_policy_id)
            .where(Project.trace_retention_policy_id.isnot(None))
            .where(Project.id.in_(ids))
        )
        async with self._db() as session:
            data = await session.execute(stmt)
        result = {project_rowid: policy_id for project_rowid, policy_id in data.all()}
        return [
            result.get(project_rowid, DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID)
            for project_rowid in keys
        ]
