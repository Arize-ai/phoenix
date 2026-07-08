from datetime import datetime, timezone
from typing import Any

import pytest

from phoenix.db import models
from phoenix.db.models import ExperimentRunOutput
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def simple_dataset(
    db: DbSessionFactory,
) -> None:
    """
    A dataset with one example added in one version
    """
    async with db() as session:
        dataset = models.Dataset(
            id=0,
            name="simple dataset",
            description=None,
            metadata_={"info": "a test dataset"},
        )
        session.add(dataset)
        await session.flush()

        dataset_version_0 = models.DatasetVersion(
            id=0,
            dataset_id=0,
            description="the first version",
            metadata_={"info": "gotta get some test data somewhere"},
        )
        session.add(dataset_version_0)
        await session.flush()

        example_0 = models.DatasetExample(
            id=0,
            dataset_id=0,
        )
        session.add(example_0)
        await session.flush()

        example_0_revision_0 = models.DatasetExampleRevision(
            id=0,
            dataset_example_id=0,
            dataset_version_id=0,
            input={"in": "foo"},
            output={"out": "bar"},
            metadata_={"info": "the first reivision"},
            revision_kind="CREATE",
        )
        session.add(example_0_revision_0)
        await session.flush()


@pytest.fixture
async def simple_dataset_with_one_experiment_run(
    db: DbSessionFactory,
    simple_dataset: Any,
) -> None:
    """
    A dataset with one example added in one version plus one experiment run
    """
    async with db() as session:
        experiment_0 = models.Experiment(
            id=0,
            dataset_id=0,
            dataset_version_id=0,
            name="simple experiment",
            description=None,
            repetitions=1,
            metadata_={"info": "a test experiment"},
        )
        session.add(experiment_0)
        await session.flush()

        experiment_run_0 = models.ExperimentRun(
            id=0,
            experiment_id=0,
            dataset_example_id=0,
            repetition_number=1,
            output=ExperimentRunOutput(task_output=1),
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc),
        )
        session.add(experiment_run_0)
        await session.flush()
