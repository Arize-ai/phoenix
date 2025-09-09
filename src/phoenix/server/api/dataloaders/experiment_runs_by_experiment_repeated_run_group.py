from copy import deepcopy

from sqlalchemy import and_, func, or_, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class ExperimentRunsPage:
    runs: list[models.ExperimentRun]
    has_next: bool


DatasetExampleID: TypeAlias = int
ExperimentID: TypeAlias = int
First: TypeAlias = int
Key: TypeAlias = tuple[ExperimentID, DatasetExampleID, First]
Result: TypeAlias = ExperimentRunsPage


class ExperimentRunsByExperimentRepeatedRunGroupDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        run_group_id_to_first: dict[tuple[ExperimentID, DatasetExampleID], First] = {}
        for key in keys:
            experiment_id, dataset_example_id, first = key
            run_group_id = (experiment_id, dataset_example_id)
            run_group_id_to_first[run_group_id] = max(
                run_group_id_to_first.get(run_group_id, 1), first
            )

        rank_subquery = (
            func.row_number()
            .over(
                partition_by=[
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRun.dataset_example_id,
                ],
                order_by=models.ExperimentRun.repetition_number.asc(),
            )
            .label("rank")
            .subquery()
        )
        ranked_runs_query = select(models.ExperimentRun, rank_subquery).subquery()
        where_clauses = [
            and_(
                ranked_runs_query.c.experiment_id == experiment_id,
                ranked_runs_query.c.dataset_example_id == dataset_example_id,
                ranked_runs_query.c.rank <= first + 1,
            )
            for (experiment_id, dataset_example_id), first in run_group_id_to_first.items()
        ]
        runs_query = (
            select(ranked_runs_query)
            .where(or_(*where_clauses))
            .order_by(
                ranked_runs_query.c.experiment_id.asc(),
                ranked_runs_query.c.dataset_example_id.asc(),
                ranked_runs_query.c.repetition_number.asc(),
            )
        )

        runs_by_run_group_id: dict[
            tuple[ExperimentID, DatasetExampleID], list[models.ExperimentRun]
        ] = {}
        async with self._db() as session:
            for run, rank in (await session.scalars(runs_query)).all():
                run_group_id = (run.experiment_id, run.dataset_example_id)
                if run_group_id not in runs_by_run_group_id:
                    runs_by_run_group_id[run_group_id] = []
                runs_by_run_group_id[run_group_id].append(run)

        runs_pages = []
        for key in keys:
            experiment_id, dataset_example_id, first = key
            runs_for_key = runs_by_run_group_id[(experiment_id, dataset_example_id)]
            has_next_page = len(runs_for_key) > first
            page = ExperimentRunsPage(
                runs=deepcopy(runs_for_key[:first]),
                has_next=has_next_page,
            )
            runs_pages.append(page)

        return runs_pages
