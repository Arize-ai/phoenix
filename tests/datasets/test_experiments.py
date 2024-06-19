from datetime import datetime, timezone
from unittest.mock import patch

import nest_asyncio
from phoenix.datasets.evaluators import ContainsKeyword
from phoenix.datasets.experiments import evaluate_experiment, run_experiment
from phoenix.datasets.types import (
    Dataset,
    Example,
)
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from sqlalchemy import select
from strawberry.relay import GlobalID


async def test_run_experiment(session, sync_test_client, simple_dataset):
    nest_asyncio.apply()

    nonexistent_experiment = (await session.execute(select(models.Experiment))).scalar()
    assert not nonexistent_experiment, "There should be no experiments in the database"

    test_dataset = Dataset(
        id=str(GlobalID("Dataset", "0")),
        version_id=str(GlobalID("DatasetVersion", "0")),
        examples=[
            Example(
                id=str(GlobalID("DatasetExample", "0")),
                input={"input": "fancy input 1"},
                output={},
                metadata={},
                updated_at=datetime.now(timezone.utc),
            )
        ],
    )

    with patch("phoenix.datasets.experiments._phoenix_client", return_value=sync_test_client):

        def experiment_task(example: Example) -> str:
            return "doesn't matter, this is the output"

        experiment = run_experiment(
            dataset=test_dataset,
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
            repetitions=3,
        )
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id

        experiment_model = (await session.execute(select(models.Experiment))).scalar()
        assert experiment_model, "An experiment was run"
        assert experiment_model.dataset_id == 0
        assert experiment_model.dataset_version_id == 0
        assert experiment_model.name == "test"
        assert experiment_model.description == "test description"
        assert experiment_model.repetitions == 3

        experiment_runs = (
            (
                await session.execute(
                    select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
                )
            )
            .scalars()
            .all()
        )
        assert len(experiment_runs) == 3, "The experiment was configured to have 3 repetitions"
        for run in experiment_runs:
            assert run.output == {"result": "doesn't matter, this is the output"}

        evaluate_experiment(experiment, ContainsKeyword(keyword="correct"))
        for run in experiment_runs:
            evaluations = (
                (
                    await session.execute(
                        select(models.ExperimentAnnotation).where(
                            models.ExperimentAnnotation.experiment_run_id == run.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(evaluations) == 1
            evaluation = evaluations[0]
            assert evaluation.score == 0.0

        evaluate_experiment(experiment, ContainsKeyword(keyword="doesn't matter"))
        for run in experiment_runs:
            evaluations = (
                (
                    await session.execute(
                        select(models.ExperimentAnnotation).where(
                            models.ExperimentAnnotation.experiment_run_id == run.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(evaluations) == 2
            evaluation_2 = evaluations[1]
            assert evaluation_2.score == 1.0
