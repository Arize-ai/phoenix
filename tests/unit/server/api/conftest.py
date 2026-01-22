from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, NamedTuple

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolChoiceOneOrMore,
    PromptToolFunction,
    PromptToolFunctionDefinition,
    PromptTools,
)
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
) -> tuple[int, int]:
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


@pytest.fixture
async def playground_dataset_with_patch_revision(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    patched.
    """
    dataset = models.Dataset(
        id=1,
        name="dataset-name",
        metadata_={},
    )
    versions = [
        models.DatasetVersion(
            id=1,
            dataset_id=dataset.id,
            metadata_={},
        ),
        models.DatasetVersion(
            id=2,
            dataset_id=dataset.id,
            metadata_={},
        ),
    ]
    examples = [
        models.DatasetExample(
            id=1,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
        ),
        models.DatasetExample(
            id=2,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=2, day=2, hour=0, minute=0, tzinfo=timezone.utc),
        ),
        models.DatasetExample(
            id=3,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=2, day=3, hour=0, minute=0, tzinfo=timezone.utc),
        ),
    ]
    revisions = [
        models.DatasetExampleRevision(
            dataset_example_id=examples[0].id,
            dataset_version_id=versions[0].id,
            input={"city": "Paris"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[1].id,
            dataset_version_id=versions[0].id,
            input={"city": "Tokyo"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[0].id,
            dataset_version_id=versions[1].id,
            input={"city": "Cairo"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[2].id,
            dataset_version_id=versions[0].id,
            input={"cities": "Madrid"},
            output={},
            metadata_={},
            revision_kind="PATCH",
        ),
    ]
    async with db() as session:
        session.add(dataset)
        await session.flush()
        session.add_all(versions)
        await session.flush()
        session.add_all(examples)
        await session.flush()
        session.add_all(revisions)
        await session.flush()


@pytest.fixture
def cities_and_countries() -> list[tuple[str, str]]:
    return [
        ("Toronto", "Canada"),
        ("Paris", "France"),
        ("Tokyo", "Japan"),
    ]


@pytest.fixture
async def playground_city_and_country_dataset(
    cities_and_countries: list[tuple[str, str]], db: DbSessionFactory
) -> None:
    """
    A dataset with many example.
    """
    dataset = models.Dataset(
        id=1,
        name="dataset-name",
        metadata_={},
    )
    version = models.DatasetVersion(
        id=1,
        dataset_id=dataset.id,
        metadata_={},
    )
    examples = [
        models.DatasetExample(
            id=example_id,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
        )
        for example_id in range(1, len(cities_and_countries) + 1)
    ]
    revisions = [
        models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"city": city},
            output={"country": country},
            metadata_={},
            revision_kind="CREATE",
        )
        for example, (city, country) in zip(examples, cities_and_countries)
    ]
    async with db() as session:
        session.add(dataset)
        session.add(version)
        session.add_all(examples)
        await session.flush()
        session.add_all(revisions)
        await session.flush()


@pytest.fixture
async def correctness_llm_evaluator(db: DbSessionFactory) -> models.LLMEvaluator:
    """
    An LLM evaluator that assesses correctness.
    """
    async with db() as session:
        evaluator_name = Identifier("correctness-evaluator")
        prompt = models.Prompt(
            name=Identifier("correctness-prompt"),
            description="Prompt for correctness evaluation",
            prompt_versions=[
                models.PromptVersion(
                    template_type=PromptTemplateType.CHAT,
                    template_format=PromptTemplateFormat.MUSTACHE,
                    template=PromptChatTemplate(
                        type="chat",
                        messages=[
                            PromptMessage(
                                role="system",
                                content="You are an evaluator that assesses the correctness of outputs.",
                            ),
                            PromptMessage(
                                role="user",
                                content="Input: {{input}}\n\nOutput: {{output}}\n\nIs this output correct?",
                            ),
                        ],
                    ),
                    invocation_parameters=PromptOpenAIInvocationParameters(
                        type="openai", openai=PromptOpenAIInvocationParametersContent()
                    ),
                    tools=PromptTools(
                        type="tools",
                        tools=[
                            PromptToolFunction(
                                type="function",
                                function=PromptToolFunctionDefinition(
                                    name="evaluate_correctness",
                                    description="evaluates the correctness of the output",
                                    parameters={
                                        "type": "object",
                                        "properties": {
                                            "label": {
                                                "type": "string",
                                                "enum": ["correct", "incorrect"],
                                                "description": "correctness",
                                            },
                                        },
                                        "required": ["label"],
                                    },
                                ),
                            )
                        ],
                        tool_choice=PromptToolChoiceOneOrMore(type="one_or_more"),
                    ),
                    response_format=None,
                    model_provider=ModelProvider.OPENAI,
                    model_name="gpt-4",
                    metadata_={},
                )
            ],
        )
        llm_evaluator = models.LLMEvaluator(
            name=evaluator_name,
            description="evaluates the correctness of the output",
            kind="LLM",
            output_config=CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="correctness",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                description="correctness evaluation",
                values=[
                    CategoricalAnnotationValue(label="correct", score=1.0),
                    CategoricalAnnotationValue(label="incorrect", score=0.0),
                ],
            ),
            prompt=prompt,
        )
        session.add(llm_evaluator)
        await session.flush()
        return llm_evaluator


@pytest.fixture
async def assign_correctness_llm_evaluator_to_dataset(
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> Callable[[int], Awaitable[models.DatasetEvaluators]]:
    """
    Factory fixture to assign the correctness LLM evaluator to a dataset.
    Reuses the correctness_llm_evaluator fixture.
    """

    async def _assign_correctness_llm_evaluator_to_dataset(
        dataset_id: int,
    ) -> models.DatasetEvaluators:
        async with db() as session:
            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset_id,
                evaluator_id=correctness_llm_evaluator.id,
                display_name=correctness_llm_evaluator.name,
                input_mapping={},
                output_config_override=None,
                project=models.Project(
                    name="correctness-evaluator-project",
                    description="Project for llm evaluator",
                ),
            )
            session.add(dataset_evaluator)
            await session.flush()
            return dataset_evaluator

    return _assign_correctness_llm_evaluator_to_dataset


@pytest.fixture
async def single_example_dataset(db: DbSessionFactory) -> models.Dataset:
    """
    A dataset with a single example.
    """
    async with db() as session:
        dataset = models.Dataset(name="single-example-dataset", metadata_={})
        session.add(dataset)
        await session.flush()

        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(version)
        await session.flush()

        example = models.DatasetExample(
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
        )
        session.add(example)
        await session.flush()

        revision = models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"city": "Paris"},
            output={"country": "France"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(revision)
        await session.flush()

    return dataset


@pytest.fixture
async def playground_dataset_with_splits(db: DbSessionFactory) -> None:
    """
    A dataset with examples assigned to different splits for testing split-based filtering.

    Setup:
    - Dataset with 5 examples
    - 2 splits: "train" (examples 1, 2, 3) and "test" (examples 4, 5)
    - Example 3 is intentionally in only train split
    """
    dataset = models.Dataset(
        id=1,
        name="dataset-with-splits",
        metadata_={},
    )
    version = models.DatasetVersion(
        id=1,
        dataset_id=dataset.id,
        metadata_={},
    )

    # Create 5 examples
    examples = [
        models.DatasetExample(
            id=i,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=i, hour=0, minute=0, tzinfo=timezone.utc),
        )
        for i in range(1, 6)
    ]

    # Create revisions for each example
    cities = ["Paris", "Tokyo", "Berlin", "London", "Madrid"]
    revisions = [
        models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"city": city},
            output={},
            metadata_={},
            revision_kind="CREATE",
        )
        for example, city in zip(examples, cities)
    ]

    # Create two splits
    train_split = models.DatasetSplit(
        id=1,
        name="train",
        description="Training split",
        color="#0000FF",
        metadata_={},
    )
    test_split = models.DatasetSplit(
        id=2,
        name="test",
        description="Test split",
        color="#FF0000",
        metadata_={},
    )

    # Assign examples to splits
    # Train split: examples 1, 2, 3
    # Test split: examples 4, 5
    split_assignments = [
        models.DatasetSplitDatasetExample(dataset_split_id=1, dataset_example_id=1),
        models.DatasetSplitDatasetExample(dataset_split_id=1, dataset_example_id=2),
        models.DatasetSplitDatasetExample(dataset_split_id=1, dataset_example_id=3),
        models.DatasetSplitDatasetExample(dataset_split_id=2, dataset_example_id=4),
        models.DatasetSplitDatasetExample(dataset_split_id=2, dataset_example_id=5),
    ]

    async with db() as session:
        session.add(dataset)
        session.add(version)
        session.add_all(examples)
        await session.flush()
        session.add_all(revisions)
        session.add_all([train_split, test_split])
        await session.flush()
        session.add_all(split_assignments)
        await session.flush()


class ExperimentsWithIncompleteRuns(NamedTuple):
    """
    Type-safe fixture data for experiments with incomplete runs testing.
    Tests versioning, deletions, and various run states across multiple dataset versions.

    Dataset structure:
    - version1: 5 examples (ex0, ex1, ex2, ex3, ex4)
    - version2: 6 examples (ex0, ex1, ex2 [deleted], ex3 [patched], ex4, ex5 [new])

    Experiment structure:
    - experiment_v1_mixed: version1, 5 examples, mixed run states
    - experiment_v1_empty: version1, 5 examples, no runs
    - experiment_v2_with_deletion: version2, 4 examples (ex2 deleted), mixed runs
    - experiment_v2_incremental: version2, 2 examples, no runs (for incremental testing)
    """

    # Core dataset
    dataset: models.Dataset

    # Dataset versions
    version1: models.DatasetVersion
    version2: models.DatasetVersion

    # Examples organized by lifecycle
    examples_in_v1: list[models.DatasetExample]  # all 5 examples in version1
    examples_in_v2_active: list[models.DatasetExample]  # 5 active in v2 (ex0,ex1,ex3,ex4,ex5)
    example_deleted_in_v2: models.DatasetExample  # ex2 - exists in v1, deleted in v2
    example_added_in_v2: models.DatasetExample  # ex5 - only in v2

    # Revisions for version1
    revisions_v1: list[models.DatasetExampleRevision]  # 5 CREATE revisions

    # Revisions for version2
    revisions_v2: list[models.DatasetExampleRevision]  # mixed CREATE/PATCH/DELETE

    # Experiments on version1
    experiment_v1_mixed: models.Experiment  # 5 examples, 7 successful + 3 failed runs
    experiment_v1_empty: models.Experiment  # 5 examples, 0 runs

    # Experiments on version2
    experiment_v2_with_deletion: models.Experiment  # 4 examples (ex2 deleted), mixed runs
    experiment_v2_incremental: models.Experiment  # 2 examples, 0 runs (for testing)

    # Helper mappings
    example_by_name: dict[str, models.DatasetExample]  # "ex0" -> example object
    example_id_map: dict[int, int]  # maps v1 example index (0-4) to example ID


@pytest.fixture
async def experiments_with_incomplete_runs(db: DbSessionFactory) -> ExperimentsWithIncompleteRuns:
    """
    Comprehensive fixture for testing experiments across multiple dataset versions.
    Tests versioning, deletions, patches, and various run completion states.
    """
    async with db() as session:
        # Create dataset
        dataset = models.Dataset(
            name="test-dataset-versioning",
            metadata_={},
        )
        session.add(dataset)
        await session.flush()
        dataset_id = dataset.id

        # ===== VERSION 1 =====
        version1 = models.DatasetVersion(
            dataset_id=dataset_id,
            metadata_={"version": 1},
        )
        session.add(version1)
        await session.flush()
        v1_id = version1.id

        # Create 5 examples for version 1 (ex0-ex4)
        examples_v1 = []
        example_ids_v1 = []
        for i in range(5):
            example = models.DatasetExample(dataset_id=dataset_id)
            session.add(example)
            await session.flush()
            examples_v1.append(example)
            example_ids_v1.append(example.id)

        # Create revisions for version 1 (all CREATE)
        revisions_v1 = []
        revision_ids_v1 = []
        for i, example in enumerate(examples_v1):
            revision = models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=v1_id,
                input={"query": f"ex{i}-v1"},
                output={"response": f"expected-{i}-v1"},
                metadata_={},
                revision_kind="CREATE",
            )
            session.add(revision)
            await session.flush()
            revisions_v1.append(revision)
            revision_ids_v1.append(revision.id)

        # ===== VERSION 2 =====
        version2 = models.DatasetVersion(
            dataset_id=dataset_id,
            metadata_={"version": 2},
        )
        session.add(version2)
        await session.flush()
        v2_id = version2.id

        # Create one new example for version 2 (ex5)
        ex5 = models.DatasetExample(dataset_id=dataset_id)
        session.add(ex5)
        await session.flush()

        # Create revisions for version 2:
        # - ex0, ex1, ex4: CREATE (carried forward)
        # - ex2: DELETE (removed in v2)
        # - ex3: PATCH (modified in v2)
        # - ex5: CREATE (new in v2)
        revisions_v2 = []
        revision_ids_v2 = []

        # ex0: CREATE (carried forward unchanged)
        rev = models.DatasetExampleRevision(
            dataset_example_id=examples_v1[0].id,
            dataset_version_id=v2_id,
            input={"query": "ex0-v1"},  # same as v1
            output={"response": "expected-0-v1"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(rev)
        await session.flush()
        revisions_v2.append(rev)
        revision_ids_v2.append(rev.id)

        # ex1: CREATE (carried forward unchanged)
        rev = models.DatasetExampleRevision(
            dataset_example_id=examples_v1[1].id,
            dataset_version_id=v2_id,
            input={"query": "ex1-v1"},
            output={"response": "expected-1-v1"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(rev)
        await session.flush()
        revisions_v2.append(rev)
        revision_ids_v2.append(rev.id)

        # ex2: DELETE (removed in v2)
        rev_deleted = models.DatasetExampleRevision(
            dataset_example_id=examples_v1[2].id,
            dataset_version_id=v2_id,
            input={},
            output={},
            metadata_={},
            revision_kind="DELETE",
        )
        session.add(rev_deleted)
        await session.flush()
        revisions_v2.append(rev_deleted)

        # ex3: PATCH (modified in v2)
        rev = models.DatasetExampleRevision(
            dataset_example_id=examples_v1[3].id,
            dataset_version_id=v2_id,
            input={"query": "ex3-v2-patched"},  # changed
            output={"response": "expected-3-v2-patched"},
            metadata_={},
            revision_kind="PATCH",
        )
        session.add(rev)
        await session.flush()
        revisions_v2.append(rev)
        revision_ids_v2.append(rev.id)

        # ex4: CREATE (carried forward unchanged)
        rev = models.DatasetExampleRevision(
            dataset_example_id=examples_v1[4].id,
            dataset_version_id=v2_id,
            input={"query": "ex4-v1"},
            output={"response": "expected-4-v1"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(rev)
        await session.flush()
        revisions_v2.append(rev)
        revision_ids_v2.append(rev.id)

        # ex5: CREATE (new in v2)
        rev_new = models.DatasetExampleRevision(
            dataset_example_id=ex5.id,
            dataset_version_id=v2_id,
            input={"query": "ex5-v2-new"},
            output={"response": "expected-5-v2-new"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(rev_new)
        await session.flush()
        revisions_v2.append(rev_new)
        revision_ids_v2.append(rev_new.id)

        now = datetime.now(timezone.utc)

        # ===== EXPERIMENT 1: version1, 5 examples, mixed runs =====
        # ex0(3 success), ex1(1 success, 1 fail, 1 miss), ex2(all miss),
        # ex3(2 success, 1 fail), ex4(1 fail, 1 miss, 1 success)
        # Total: 7 successful, 3 failed
        exp_v1_mixed = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=v1_id,
            name="exp-v1-mixed-runs",
            repetitions=3,
            metadata_={},
        )
        session.add(exp_v1_mixed)
        await session.flush()

        # Link all 5 examples from v1
        for example_id, revision_id in zip(example_ids_v1, revision_ids_v1):
            junction = models.ExperimentDatasetExample(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_id,
                dataset_example_revision_id=revision_id,
            )
            session.add(junction)
        await session.flush()

        # Add runs
        for rep in [1, 2, 3]:
            session.add(
                models.ExperimentRun(
                    experiment_id=exp_v1_mixed.id,
                    dataset_example_id=example_ids_v1[0],
                    repetition_number=rep,
                    output={"result": f"ex0-rep{rep}"},
                    error=None,
                    start_time=now,
                    end_time=now,
                )
            )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_ids_v1[1],
                repetition_number=1,
                output={"result": "ex1-rep1"},
                error=None,
                start_time=now,
                end_time=now,
            )
        )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_ids_v1[1],
                repetition_number=2,
                output=None,
                error="Failed",
                start_time=now,
                end_time=now,
            )
        )
        for rep in [1, 2]:
            session.add(
                models.ExperimentRun(
                    experiment_id=exp_v1_mixed.id,
                    dataset_example_id=example_ids_v1[3],
                    repetition_number=rep,
                    output={"result": f"ex3-rep{rep}"},
                    error=None,
                    start_time=now,
                    end_time=now,
                )
            )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_ids_v1[3],
                repetition_number=3,
                output=None,
                error="Failed",
                start_time=now,
                end_time=now,
            )
        )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_ids_v1[4],
                repetition_number=1,
                output=None,
                error="Failed",
                start_time=now,
                end_time=now,
            )
        )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v1_mixed.id,
                dataset_example_id=example_ids_v1[4],
                repetition_number=3,
                output={"result": "ex4-rep3"},
                error=None,
                start_time=now,
                end_time=now,
            )
        )
        await session.flush()

        # ===== EXPERIMENT 2: version1, 5 examples, no runs =====
        exp_v1_empty = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=v1_id,
            name="exp-v1-empty",
            repetitions=2,
            metadata_={},
        )
        session.add(exp_v1_empty)
        await session.flush()

        for example_id, revision_id in zip(example_ids_v1, revision_ids_v1):
            junction = models.ExperimentDatasetExample(
                experiment_id=exp_v1_empty.id,
                dataset_example_id=example_id,
                dataset_example_revision_id=revision_id,
            )
            session.add(junction)
        await session.flush()

        # ===== EXPERIMENT 3: version2, 4 examples (ex2 deleted), mixed runs =====
        # Uses: ex0, ex1, ex3 (patched), ex4
        # Runs: ex0(2 success), ex1(1 success, 1 fail), ex3(no runs), ex4(1 success)
        # Total: 4 successful, 1 failed
        exp_v2_deletion = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=v2_id,
            name="exp-v2-with-deletion",
            repetitions=2,
            metadata_={},
        )
        session.add(exp_v2_deletion)
        await session.flush()

        # Link ex0, ex1, ex3, ex4 from v2 (ex2 is deleted, ex5 not included)
        # revision_ids_v2: [ex0, ex1, ex2(DELETE), ex3, ex4, ex5]
        # We want indices: 0, 1, 3, 4
        for idx, revision_idx in [(0, 0), (1, 1), (3, 3), (4, 4)]:
            junction = models.ExperimentDatasetExample(
                experiment_id=exp_v2_deletion.id,
                dataset_example_id=example_ids_v1[idx],
                dataset_example_revision_id=revision_ids_v2[revision_idx],
            )
            session.add(junction)
        await session.flush()

        # Add runs
        for rep in [1, 2]:
            session.add(
                models.ExperimentRun(
                    experiment_id=exp_v2_deletion.id,
                    dataset_example_id=example_ids_v1[0],
                    repetition_number=rep,
                    output={"result": f"ex0-v2-rep{rep}"},
                    error=None,
                    start_time=now,
                    end_time=now,
                )
            )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v2_deletion.id,
                dataset_example_id=example_ids_v1[1],
                repetition_number=1,
                output={"result": "ex1-v2-rep1"},
                error=None,
                start_time=now,
                end_time=now,
            )
        )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v2_deletion.id,
                dataset_example_id=example_ids_v1[1],
                repetition_number=2,
                output=None,
                error="Failed",
                start_time=now,
                end_time=now,
            )
        )
        session.add(
            models.ExperimentRun(
                experiment_id=exp_v2_deletion.id,
                dataset_example_id=example_ids_v1[4],
                repetition_number=1,
                output={"result": "ex4-v2-rep1"},
                error=None,
                start_time=now,
                end_time=now,
            )
        )
        await session.flush()

        # ===== EXPERIMENT 4: version2, 2 examples (ex5 new + ex0), no runs =====
        exp_v2_incremental = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=v2_id,
            name="exp-v2-incremental",
            repetitions=3,
            metadata_={},
        )
        session.add(exp_v2_incremental)
        await session.flush()

        # Link ex0 and ex5
        junction = models.ExperimentDatasetExample(
            experiment_id=exp_v2_incremental.id,
            dataset_example_id=examples_v1[0].id,
            dataset_example_revision_id=revision_ids_v2[0],
        )
        session.add(junction)
        junction = models.ExperimentDatasetExample(
            experiment_id=exp_v2_incremental.id,
            dataset_example_id=ex5.id,
            dataset_example_revision_id=rev_new.id,  # ex5's revision
        )
        session.add(junction)
        await session.flush()

        # Build example_by_name mapping
        example_by_name = {
            "ex0": examples_v1[0],
            "ex1": examples_v1[1],
            "ex2": examples_v1[2],
            "ex3": examples_v1[3],
            "ex4": examples_v1[4],
            "ex5": ex5,
        }

        # Build example_id_map for v1 examples (index -> id)
        example_id_map = {i: example.id for i, example in enumerate(examples_v1)}

        # Examples active in v2 (ex2 deleted)
        examples_v2_active = [examples_v1[0], examples_v1[1], examples_v1[3], examples_v1[4], ex5]

    return ExperimentsWithIncompleteRuns(
        dataset=dataset,
        version1=version1,
        version2=version2,
        examples_in_v1=examples_v1,
        examples_in_v2_active=examples_v2_active,
        example_deleted_in_v2=examples_v1[2],
        example_added_in_v2=ex5,
        revisions_v1=revisions_v1,
        revisions_v2=revisions_v2,
        experiment_v1_mixed=exp_v1_mixed,
        experiment_v1_empty=exp_v1_empty,
        experiment_v2_with_deletion=exp_v2_deletion,
        experiment_v2_incremental=exp_v2_incremental,
        example_by_name=example_by_name,
        example_id_map=example_id_map,
    )
