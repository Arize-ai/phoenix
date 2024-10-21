from datetime import datetime
from typing import Any, Tuple

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def span_data_with_documents(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="61d6af1c1765cf22f5d0454d30a09be7",
            start_time=datetime.now(),
            end_time=datetime.now(),
        )
        session.add(trace)
        await session.flush()

        span = models.Span(
            trace_rowid=trace.id,
            span_id="f2fbba1d7911049c",
            name="foo",
            span_kind="bar",
            start_time=datetime.now(),
            end_time=datetime.now(),
            attributes={
                "retrieval": {
                    "documents": [
                        {"document": {"content": "zero"}},
                        {"document": {"content": "one"}},
                    ]
                }
            },
            events=[
                {
                    "name": "exception",
                    "timestamp": datetime.now(),
                    "exception.message": "uh-oh",
                }
            ],
            status_code="ERROR",
            status_message="no",
            cumulative_error_count=1,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span)
        await session.flush()


@pytest.fixture
async def simple_dataset(db: DbSessionFactory) -> None:
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
async def empty_dataset(db: DbSessionFactory) -> None:
    """
    A dataset with three versions, where two examples are added, patched, then deleted
    """
    async with db() as session:
        dataset = models.Dataset(
            id=1,
            name="empty dataset",
            description="emptied after two revisions",
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

        dataset_version_3 = models.DatasetVersion(
            id=3,
            dataset_id=1,
            description="data gets deleted",
            metadata_={"info": "all gone"},
        )
        session.add(dataset_version_3)
        await session.flush()

        example_1_revision_3 = models.DatasetExampleRevision(
            id=5,
            dataset_example_id=1,
            dataset_version_id=3,
            input={},
            output={},
            metadata_={"info": "all caps revision"},
            revision_kind="DELETE",
        )
        session.add(example_1_revision_3)
        await session.flush()

        example_2_revision_3 = models.DatasetExampleRevision(
            id=6,
            dataset_example_id=2,
            dataset_version_id=3,
            input={},
            output={},
            metadata_={"info": "all caps revision"},
            revision_kind="DELETE",
        )
        session.add(example_2_revision_3)
        await session.flush()


@pytest.fixture
async def dataset_with_revisions(db: DbSessionFactory) -> None:
    """
    A dataset with six versions, first two examples are added, then one example is patched and a
    third example is added.

    The last four revisions alternate between adding then removing an example.
    """
    async with db() as session:
        dataset = models.Dataset(
            id=2,
            name="revised dataset",
            description="this dataset grows over time",
            metadata_={},
        )
        session.add(dataset)
        await session.flush()

        dataset_version_4 = models.DatasetVersion(
            id=4,
            dataset_id=2,
            description="data gets added",
            metadata_={"info": "gotta get some test data somewhere"},
            created_at=datetime.fromisoformat("2024-05-28T00:00:04+00:00"),
        )
        session.add(dataset_version_4)
        await session.flush()

        example_3 = models.DatasetExample(
            id=3,
            dataset_id=2,
        )
        session.add(example_3)
        await session.flush()

        example_4 = models.DatasetExample(
            id=4,
            dataset_id=2,
        )
        session.add(example_4)
        await session.flush()

        example_3_revision_4 = models.DatasetExampleRevision(
            id=7,
            dataset_example_id=3,
            dataset_version_id=4,
            input={"in": "foo"},
            output={"out": "bar"},
            metadata_={"info": "first revision"},
            revision_kind="CREATE",
        )
        session.add(example_3_revision_4)
        await session.flush()

        example_4_revision_4 = models.DatasetExampleRevision(
            id=8,
            dataset_example_id=4,
            dataset_version_id=4,
            input={"in": "foofoo"},
            output={"out": "barbar"},
            metadata_={"info": "first revision"},
            revision_kind="CREATE",
        )
        session.add(example_4_revision_4)
        await session.flush()

        dataset_version_5 = models.DatasetVersion(
            id=5,
            dataset_id=2,
            description="data gets patched and added",
            metadata_={},
            created_at=datetime.fromisoformat("2024-05-28T00:00:05+00:00"),
        )
        session.add(dataset_version_5)
        await session.flush()

        dataset_version_6 = models.DatasetVersion(
            id=6,
            dataset_id=2,
            description="datum gets created",
            metadata_={},
            created_at=datetime.fromisoformat("2024-05-28T00:00:06+00:00"),
        )
        session.add(dataset_version_6)
        await session.flush()

        dataset_version_7 = models.DatasetVersion(
            id=7,
            dataset_id=2,
            description="datum gets deleted",
            metadata_={},
            created_at=datetime.fromisoformat("2024-05-28T00:00:07+00:00"),
        )
        session.add(dataset_version_7)
        await session.flush()

        dataset_version_8 = models.DatasetVersion(
            id=8,
            dataset_id=2,
            description="datum gets created",
            metadata_={},
            created_at=datetime.fromisoformat("2024-05-28T00:00:08+00:00"),
        )
        session.add(dataset_version_8)
        await session.flush()

        dataset_version_9 = models.DatasetVersion(
            id=9,
            dataset_id=2,
            description="datum gets deleted",
            metadata_={},
            created_at=datetime.fromisoformat("2024-05-28T00:00:09+00:00"),
        )
        session.add(dataset_version_9)
        await session.flush()

        example_5 = models.DatasetExample(
            id=5,
            dataset_id=2,
        )
        session.add(example_5)
        await session.flush()

        example_6 = models.DatasetExample(
            id=6,
            dataset_id=2,
        )
        session.add(example_6)
        await session.flush()

        example_7 = models.DatasetExample(
            id=7,
            dataset_id=2,
        )
        session.add(example_7)
        await session.flush()

        example_4_revision_5 = models.DatasetExampleRevision(
            id=9,
            dataset_example_id=4,
            dataset_version_id=5,
            input={"in": "updated foofoo"},
            output={"out": "updated barbar"},
            metadata_={"info": "updating revision"},
            revision_kind="PATCH",
        )
        session.add(example_4_revision_5)
        await session.flush()

        example_5_revision_5 = models.DatasetExampleRevision(
            id=10,
            dataset_example_id=5,
            dataset_version_id=5,
            input={"in": "look at me"},
            output={"out": "i have all the answers"},
            metadata_={"info": "a new example"},
            revision_kind="CREATE",
        )
        session.add(example_5_revision_5)
        await session.flush()

        example_6_revision_6 = models.DatasetExampleRevision(
            id=11,
            dataset_example_id=example_6.id,
            dataset_version_id=dataset_version_6.id,
            input={"in": "look at us"},
            output={"out": "we have all the answers"},
            metadata_={"info": "a new example"},
            revision_kind="CREATE",
        )
        session.add(example_6_revision_6)
        await session.flush()

        example_6_revision_7 = models.DatasetExampleRevision(
            id=12,
            dataset_example_id=example_6.id,
            dataset_version_id=dataset_version_7.id,
            input={"in": "look at us"},
            output={"out": "we have all the answers"},
            metadata_={"info": "a new example"},
            revision_kind="DELETE",
        )
        session.add(example_6_revision_7)
        await session.flush()

        example_7_revision_8 = models.DatasetExampleRevision(
            id=13,
            dataset_example_id=example_7.id,
            dataset_version_id=dataset_version_8.id,
            input={"in": "look at me"},
            output={"out": "i have all the answers"},
            metadata_={"info": "a newer example"},
            revision_kind="CREATE",
        )
        session.add(example_7_revision_8)
        await session.flush()

        example_7_revision_9 = models.DatasetExampleRevision(
            id=14,
            dataset_example_id=example_7.id,
            dataset_version_id=dataset_version_9.id,
            input={"in": "look at me"},
            output={"out": "i have all the answers"},
            metadata_={"info": "a newer example"},
            revision_kind="DELETE",
        )
        session.add(example_7_revision_9)
        await session.flush()


@pytest.fixture
async def dataset_with_experiments_without_runs(
    db: DbSessionFactory,
    empty_dataset: Any,
) -> None:
    async with db() as session:
        experiment_0 = models.Experiment(
            id=0,
            dataset_id=1,
            dataset_version_id=1,
            name="test",
            repetitions=1,
            project_name="default",
            metadata_={"info": "a test experiment"},
        )
        session.add(experiment_0)
        await session.flush()

        experiment_1 = models.Experiment(
            id=1,
            dataset_id=1,
            dataset_version_id=2,
            name="second test",
            repetitions=1,
            project_name="random",
            metadata_={"info": "a second test experiment"},
        )
        session.add(experiment_1)
        await session.flush()


@pytest.fixture
async def dataset_with_experiments_and_runs(
    db: DbSessionFactory,
    dataset_with_experiments_without_runs: Any,
) -> None:
    async with db() as session:
        experiment_run_0 = models.ExperimentRun(
            id=0,
            experiment_id=0,
            dataset_example_id=1,
            output={"out": "barr"},
            repetition_number=1,
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
            repetition_number=1,
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
            repetition_number=1,
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
            repetition_number=1,
            start_time=datetime.now(),
            end_time=datetime.now(),
            error="something funny happened",
        )
        session.add(experiment_run_3)
        await session.flush()


@pytest.fixture
async def dataset_with_experiments_runs_and_evals(
    db: DbSessionFactory,
    dataset_with_experiments_and_runs: Any,
) -> None:
    async with db() as session:
        experiment_evaluation_0 = models.ExperimentRunAnnotation(
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

        experiment_evaluation_1 = models.ExperimentRunAnnotation(
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

        experiment_evaluation_2 = models.ExperimentRunAnnotation(
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

        experiment_evaluation_3 = models.ExperimentRunAnnotation(
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


@pytest.fixture
async def dataset_with_messages(
    db: DbSessionFactory,
) -> Tuple[int, int]:
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).returning(models.Dataset.id),
            [{"name": "xyz", "metadata_": {}}],
        )
        dataset_version_id = await session.scalar(
            insert(models.DatasetVersion).returning(models.DatasetVersion.id),
            [{"dataset_id": dataset_id, "metadata_": {}}],
        )
        dataset_example_ids = list(
            await session.scalars(
                insert(models.DatasetExample).returning(models.DatasetExample.id),
                [{"dataset_id": dataset_id}, {"dataset_id": dataset_id}],
            )
        )
        await session.scalar(
            insert(models.DatasetExampleRevision).returning(models.DatasetExampleRevision.id),
            [
                {
                    "revision_kind": "CREATE",
                    "dataset_example_id": dataset_example_ids[0],
                    "dataset_version_id": dataset_version_id,
                    "input": {
                        "messages": [
                            {"role": "system", "content": "x"},
                            {"role": "user", "content": "y"},
                        ]
                    },
                    "output": {
                        "messages": [
                            {"role": "assistant", "content": "z"},
                        ]
                    },
                    "metadata_": {},
                },
                {
                    "revision_kind": "CREATE",
                    "dataset_example_id": dataset_example_ids[1],
                    "dataset_version_id": dataset_version_id,
                    "input": {
                        "messages": [
                            {"role": "system", "content": "xx"},
                            {"role": "user", "content": "yy"},
                        ]
                    },
                    "output": {
                        "messages": [
                            {"role": "assistant", "content": "zz"},
                        ]
                    },
                    "metadata_": {},
                },
            ],
        )
        assert dataset_id is not None
        assert dataset_version_id is not None
        return dataset_id, dataset_version_id
