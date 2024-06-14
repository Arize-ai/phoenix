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

        def examples(self):
            example_gid = str(GlobalID("DatasetExample", "0"))
            return [TestExample(id=example_gid, input="fancy input 1")]

    class BasicEvaluator:
        def __init__(self, contains: str):
            self.contains = contains

        def __call__(self, input, reference, output):
            score = float(self.contains in output["output"])
            return {
                "score": score,
                "explanation": "the string {repr(self.contains)} was in the output",
            }

    with patch("phoenix.datasets.experiments._phoenix_client", return_value=sync_test_client):

        def experiment_task(input):
            return {"output": "doesn't matter, this is the output"}

        experiment = run_experiment(TestDataset(), experiment_task)
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id

        experiment_model = (await session.execute(select(models.Experiment))).scalar()
        assert experiment_model, "An experiment was run"
        assert experiment_model.dataset_id == 0
        assert experiment_model.dataset_version_id == 0

        experiment_run = (
            await session.execute(
                select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
            )
        ).scalar()
        assert experiment_run.output == {"output": "doesn't matter, this is the output"}
        evaluate_experiment(experiment, BasicEvaluator(contains="correct"))
