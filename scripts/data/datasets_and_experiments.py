from datetime import datetime

from phoenix.config import (
    get_env_database_connection_str,
)
from phoenix.db import models
from phoenix.server.app import (
    _db,
    create_engine_and_run_migrations,
)

db_connection_str = get_env_database_connection_str()
engine = create_engine_and_run_migrations(db_connection_str)
session_factory = _db(engine)


async def revised_dataset(session):
    """
    A dataset with two versions, where two examples are added, then patched
    """

    dataset = models.Dataset(
        id=1,
        name="revised dataset",
        description="dataset with two revisions",
        metadata_={},
    )
    session.add(dataset)
    await session.flush()

    dataset_version_1 = models.DatasetVersion(
        id=1,
        dataset_id=1,
        description="data gets added",
        metadata_={"info": "gotta get some test data somewhere"},
    )
    session.add(dataset_version_1)
    await session.flush()

    example_1 = models.DatasetExample(
        id=1,
        dataset_id=1,
    )
    session.add(example_1)
    await session.flush()

    example_2 = models.DatasetExample(
        id=2,
        dataset_id=1,
    )
    session.add(example_2)
    await session.flush()

    example_1_revision_1 = models.DatasetExampleRevision(
        id=1,
        dataset_example_id=1,
        dataset_version_id=1,
        input={"in": "foo"},
        output={"out": "bar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_1_revision_1)
    await session.flush()

    example_2_revision_1 = models.DatasetExampleRevision(
        id=2,
        dataset_example_id=2,
        dataset_version_id=1,
        input={"in": "foofoo"},
        output={"out": "barbar"},
        metadata_={"info": "first revision"},
        revision_kind="CREATE",
    )
    session.add(example_2_revision_1)
    await session.flush()

    dataset_version_2 = models.DatasetVersion(
        id=2,
        dataset_id=1,
        description="data gets patched",
        metadata_={"info": "all caps patch"},
    )
    session.add(dataset_version_2)
    await session.flush()

    example_1_revision_2 = models.DatasetExampleRevision(
        id=3,
        dataset_example_id=1,
        dataset_version_id=2,
        input={"in": "FOO"},
        output={"out": "BAR"},
        metadata_={"info": "all caps revision"},
        revision_kind="PATCH",
    )
    session.add(example_1_revision_2)
    await session.flush()

    example_2_revision_2 = models.DatasetExampleRevision(
        id=4,
        dataset_example_id=2,
        dataset_version_id=2,
        input={"in": "FOOFOO"},
        output={"out": "BARBAR"},
        metadata_={"info": "all caps revision"},
        revision_kind="PATCH",
    )
    session.add(example_2_revision_2)
    await session.flush()


async def dataset_with_experiments_without_runs(session):
    experiment_0 = models.Experiment(
        id=0,
        dataset_id=1,
        dataset_version_id=1,
        metadata_={"info": "a test experiment"},
    )
    session.add(experiment_0)
    await session.flush()

    experiment_1 = models.Experiment(
        id=1,
        dataset_id=1,
        dataset_version_id=2,
        metadata_={"info": "a second test experiment"},
    )
    session.add(experiment_1)
    await session.flush()


async def dataset_with_experiments_and_runs(session):
    experiment_run_0 = models.ExperimentRun(
        id=0,
        experiment_id=0,
        dataset_example_id=1,
        output={"out": "barr"},
        start_time=datetime.now(),
        end_time=datetime.now(),
        error=None,
    )
    session.add(experiment_run_0)
    await session.flush()

    experiment_run_1 = models.ExperimentRun(
        id=1,
        experiment_id=0,
        dataset_example_id=2,
        output={"out": "barbarr"},
        start_time=datetime.now(),
        end_time=datetime.now(),
        error=None,
    )
    session.add(experiment_run_1)
    await session.flush()

    experiment_run_2 = models.ExperimentRun(
        id=2,
        experiment_id=1,
        dataset_example_id=1,
        output={"out": "bar"},
        start_time=datetime.now(),
        end_time=datetime.now(),
        error=None,
    )
    session.add(experiment_run_2)
    await session.flush()

    experiment_run_3 = models.ExperimentRun(
        id=3,
        experiment_id=1,
        dataset_example_id=2,
        output=None,
        start_time=datetime.now(),
        end_time=datetime.now(),
        error="something funny happened",
    )
    session.add(experiment_run_3)
    await session.flush()


async def dataset_with_experiments_runs_and_evals(session):
    experiment_evaluation_0 = models.ExperimentAnnotation(
        id=0,
        experiment_run_id=0,
        name="test",
        annotator_kind="LLM",
        label="test",
        score=0.8,
        explanation="test",
        error=None,
        metadata_={"info": "a test evaluation"},
        start_time=datetime.now(),
        end_time=datetime.now(),
    )
    session.add(experiment_evaluation_0)
    await session.flush()

    experiment_evaluation_1 = models.ExperimentAnnotation(
        id=1,
        experiment_run_id=1,
        name="test",
        annotator_kind="LLM",
        label="test",
        score=0.9,
        explanation="test",
        error=None,
        metadata_={"info": "a test evaluation"},
        start_time=datetime.now(),
        end_time=datetime.now(),
    )
    session.add(experiment_evaluation_1)
    await session.flush()

    experiment_evaluation_2 = models.ExperimentAnnotation(
        id=2,
        experiment_run_id=2,
        name="second experiment",
        annotator_kind="LLM",
        label="test2",
        score=1,
        explanation="test",
        error=None,
        metadata_={"info": "a test evaluation"},
        start_time=datetime.now(),
        end_time=datetime.now(),
    )
    session.add(experiment_evaluation_2)
    await session.flush()

    experiment_evaluation_3 = models.ExperimentAnnotation(
        id=3,
        experiment_run_id=3,
        name="experiment",
        annotator_kind="LLM",
        label="test2",
        score=None,
        explanation="test",
        error="something funnier happened",
        metadata_={"info": "a test evaluation"},
        start_time=datetime.now(),
        end_time=datetime.now(),
    )
    session.add(experiment_evaluation_3)
    await session.flush()


async def main():
    async with session_factory() as session:
        await revised_dataset(session)
        await dataset_with_experiments_without_runs(session)
        await dataset_with_experiments_and_runs(session)
        await dataset_with_experiments_runs_and_evals(session)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
