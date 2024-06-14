from unittest.mock import patch

import nest_asyncio
from phoenix.datasets.experiments import run_experiment
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

    experiment = (await session.execute(select(models.Experiment))).scalar()
    assert experiment, "An experiment was run"
    assert experiment.dataset_id == 0
    assert experiment.dataset_version_id == 0
    assert experiment.name == "test"
    assert experiment.description == "test description"

    experiment_run = (
        await session.execute(
            select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
        )
    ).scalar()
    assert experiment_run.output == {"output": "doesn't matter, this is the output"}
