from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import ProjectSessionAnnotation
from phoenix.server.types import DbSessionFactory

ProjectSessionId: TypeAlias = int
Key: TypeAlias = ProjectSessionId
Result: TypeAlias = list[ProjectSessionAnnotation]


class SessionAnnotationsBySessionDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        annotations_by_id: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for annotation in await session.stream_scalars(
                select(ProjectSessionAnnotation).where(
                    ProjectSessionAnnotation.project_session_id.in_(keys)
                )
            ):
                annotations_by_id[annotation.project_session_id].append(annotation)
        return [annotations_by_id[key] for key in keys]
