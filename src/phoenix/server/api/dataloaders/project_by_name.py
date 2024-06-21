from collections import defaultdict
from typing import AsyncContextManager, Callable, DefaultDict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

ProjectName: TypeAlias = str
Key: TypeAlias = ProjectName
Result: TypeAlias = Optional[models.Project]


class ProjectByNameDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        project_names = list(set(keys))
        projects_by_name: DefaultDict[Key, Result] = defaultdict(None)
        async with self._db() as session:
            data = await session.stream_scalars(
                select(models.Project).where(models.Project.name.in_(project_names))
            )
            async for project in data:
                projects_by_name[project.name] = project

        return [projects_by_name[project_name] for project_name in project_names]
