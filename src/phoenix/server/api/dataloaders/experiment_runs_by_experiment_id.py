from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetExampleID: TypeAlias = int
ExperimentID: TypeAlias = int
Key: TypeAlias = tuple[ExperimentID, Optional[DatasetExampleID]]
Result: TypeAlias = list[models.ExperimentRun]


class ExperimentRunsByExperimentIdDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = [experiment_id for experiment_id, _ in keys]
        experiment_ids_to_fetch_all_runs = set(
            experiment_id
            for experiment_id, dataset_example_id in keys
            if dataset_example_id is None
        )
        example_ids_by_experiment_id: dict[ExperimentID, list[DatasetExampleID]] = {}
        for experiment_id, example_id in keys:
            if example_id is None:
                continue
            if experiment_id not in example_ids_by_experiment_id:
                example_ids_by_experiment_id[experiment_id] = []
            example_ids_by_experiment_id[experiment_id].append(example_id)

        runs_query = (
            select(models.ExperimentRun)
            .select_from(models.ExperimentRun)
            .order_by(
                models.ExperimentRun.experiment_id.asc(),
                models.ExperimentRun.dataset_example_id.asc(),
                models.ExperimentRun.repetition_number.asc(),
            )
            .options(joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id))
        )
        where_clauses = []
        for experiment_id in experiment_ids:
            if experiment_id in experiment_ids_to_fetch_all_runs:
                where_clauses.append(models.ExperimentRun.experiment_id == experiment_id)
            else:
                example_ids = example_ids_by_experiment_id[experiment_id]
                where_clauses.append(
                    and_(
                        models.ExperimentRun.experiment_id == experiment_id,
                        models.ExperimentRun.dataset_example_id.in_(example_ids),
                    )
                )
        runs_query = runs_query.where(or_(*where_clauses))

        runs_by_id: dict[ExperimentID, dict[DatasetExampleID, list[models.ExperimentRun]]] = {}
        async with self._db() as session:
            for run in (await session.scalars(runs_query)).all():
                experiment_id = run.experiment_id
                example_id = run.dataset_example_id
                if experiment_id not in runs_by_id:
                    runs_by_id[experiment_id] = {}
                if example_id not in runs_by_id[experiment_id]:
                    runs_by_id[experiment_id][example_id] = []
                runs_by_id[experiment_id][example_id].append(run)

        runs_by_key: dict[Key, list[models.ExperimentRun]] = {}
        for key in keys:
            experiment_id, example_id = key
            if example_id is None:
                runs_by_key[key] = [
                    run for runs in runs_by_id[experiment_id].values() for run in runs
                ]
            else:
                runs_by_key[key] = runs_by_id[experiment_id][example_id]

        return [runs_by_key.get(key, []) for key in keys]
