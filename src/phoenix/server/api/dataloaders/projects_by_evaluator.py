from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

EvaluatorID: TypeAlias = int
Key: TypeAlias = EvaluatorID
Result: TypeAlias = list[models.Project]


class ProjectsByEvaluatorDataLoader(DataLoader[Key, Result]):
    """Batches requests for projects associated with evaluators."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        projects_by_evaluator: dict[Key, list[models.Project]] = defaultdict(list)

        async with self._db.read() as session:
            stmt = (
                select(models.ProjectEvaluatorCriteria.evaluator_id, models.Project)
                .join(
                    models.Project,
                    models.ProjectEvaluatorCriteria.project_id == models.Project.id,
                )
                .where(models.ProjectEvaluatorCriteria.evaluator_id.in_(keys))
                .distinct()
                .order_by(models.Project.name.asc())
            )
            for row in await session.execute(stmt):
                evaluator_id, project = row
                projects_by_evaluator[evaluator_id].append(project)

        return [projects_by_evaluator.get(key, []) for key in keys]
