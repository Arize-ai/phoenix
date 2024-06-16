from dataclasses import dataclass
from unittest.mock import patch

import nest_asyncio
from phoenix.datasets.experiments import evaluate_experiment, run_experiment
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from sqlalchemy import select
from strawberry.relay import GlobalID


async def test_run_experiment(session, sync_test_client, simple_dataset):
    nest_asyncio.apply()

    nonexistent_experiment = (await session.execute(select(models.Experiment))).scalar()
    assert not nonexistent_experiment, "There should be no experiments in the database"

    class TestExample:
        def __init__(self, id, input):
            self.id = id
            self.input = input

    class TestDataset:
        id = str(GlobalID("Dataset", "0"))
        version_id = str(GlobalID("DatasetVersion", "0"))

        @property
        def examples(self):
            example_gid = str(GlobalID("DatasetExample", "0"))
            return [TestExample(id=example_gid, input="fancy input 1")]

    @dataclass
    class EvaluationType:
        score: float
        explanation: str
        metadata: dict

    class BasicEvaluator:
        def __init__(self, contains: str):
            self.contains = contains

        def __call__(self, input: dict, reference: dict, output: dict) -> EvaluationType:
            score = float(self.contains in output["output"])
            evaluation = EvaluationType(
                score=score,
                explanation="the string {repr(self.contains)} was in the output",
                metadata={},
            )
            return evaluation

    with patch("phoenix.datasets.experiments._phoenix_client", return_value=sync_test_client):

        def experiment_task(input):
            return {"output": "doesn't matter, this is the output"}

        experiment = run_experiment(
            dataset=TestDataset(),
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
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

        experiment_run = (
            await session.execute(
                select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
            )
        ).scalar()
        assert experiment_run.output == {"output": "doesn't matter, this is the output"}

        evaluate_experiment(experiment, BasicEvaluator(contains="correct"))
        evaluations = (
            (
                await session.execute(
                    select(models.ExperimentAnnotation).where(
                        models.ExperimentAnnotation.experiment_run_id == experiment_run.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(evaluations) == 1
        evaluation_1 = evaluations[0]
        assert evaluation_1.score == 0.0

        evaluate_experiment(experiment, BasicEvaluator(contains="doesn't matter"))
        evaluations = (
            (
                await session.execute(
                    select(models.ExperimentAnnotation).where(
                        models.ExperimentAnnotation.experiment_run_id == experiment_run.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(evaluations) == 2
        evaluation_2 = evaluations[1]
        assert evaluation_2.score == 1.0
