import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_projects_omits_experiment_projects(
    gql_client: AsyncGraphQLClient,
    projects_with_and_without_experiments: Any,
) -> None:
    query = """
      query {
        projects {
          edges {
            project: node {
              id
              name
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data == {
        "projects": {
            "edges": [
                {
                    "project": {
                        "id": str(GlobalID("Project", str(1))),
                        "name": "non-experiment-project-name",
                    }
                }
            ]
        }
    }


async def test_prompts_filter_by_name(
    gql_client: AsyncGraphQLClient,
    prompts_for_filtering: Any,
) -> None:
    """Test that prompts can be filtered by name using partial matching."""
    query = """
      query ($filter: PromptFilter) {
        prompts(filter: $filter) {
          edges {
            prompt: node {
              id
              name
            }
          }
        }
      }
    """

    # Test filtering by partial name match
    response = await gql_client.execute(
        query=query, variables={"filter": {"col": "name", "value": "test"}}
    )
    assert not response.errors
    assert response.data == {
        "prompts": {
            "edges": [
                {
                    "prompt": {
                        "id": str(GlobalID("Prompt", str(1))),
                        "name": "test_prompt_one",
                    }
                },
                {
                    "prompt": {
                        "id": str(GlobalID("Prompt", str(2))),
                        "name": "test_prompt_two",
                    }
                },
            ]
        }
    }

    # Test filtering with no matches
    response = await gql_client.execute(
        query=query, variables={"filter": {"col": "name", "value": "nonexistent"}}
    )
    assert not response.errors
    assert response.data == {"prompts": {"edges": []}}

    # Test filtering with specific match
    response = await gql_client.execute(
        query=query, variables={"filter": {"col": "name", "value": "production"}}
    )
    assert not response.errors
    assert response.data == {
        "prompts": {
            "edges": [
                {
                    "prompt": {
                        "id": str(GlobalID("Prompt", str(3))),
                        "name": "production_prompt",
                    }
                }
            ]
        }
    }


async def test_prompts_without_filter(
    gql_client: AsyncGraphQLClient,
    prompts_for_filtering: Any,
) -> None:
    """Test that prompts query returns all prompts when no filter is applied."""
    query = """
      query {
        prompts {
          edges {
            prompt: node {
              id
              name
            }
          }
        }
      }
    """

    response = await gql_client.execute(query=query)
    assert not response.errors
    assert (data := response.data) is not None
    assert len(data["prompts"]["edges"]) == 3
    prompt_names = [edge["prompt"]["name"] for edge in data["prompts"]["edges"]]
    assert "test_prompt_one" in prompt_names
    assert "test_prompt_two" in prompt_names
    assert "production_prompt" in prompt_names


async def test_compare_experiments_returns_expected_comparisons(
    gql_client: AsyncGraphQLClient,
    comparison_experiments: Any,
) -> None:
    query = """
      query ($baseExperimentId: ID!, $compareExperimentIds: [ID!]!, $first: Int, $after: String) {
        compareExperiments(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
          first: $first
          after: $after
        ) {
          edges {
            node {
              example {
                id
                revision {
                  input
                  output
                  metadata
                }
              }
              repeatedRunGroups {
                experimentId
                runs {
                  id
                  output
                }
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "baseExperimentId": str(GlobalID("Experiment", str(2))),
            "compareExperimentIds": [
                str(GlobalID("Experiment", str(1))),
                str(GlobalID("Experiment", str(3))),
            ],
            "first": 50,
            "after": None,
        },
    )
    assert not response.errors
    assert response.data == {
        "compareExperiments": {
            "edges": [
                {
                    "node": {
                        "example": {
                            "id": str(GlobalID("DatasetExample", str(2))),
                            "revision": {
                                "input": {"revision-4-input-key": "revision-4-input-value"},
                                "output": {"revision-4-output-key": "revision-4-output-value"},
                                "metadata": {
                                    "revision-4-metadata-key": "revision-4-metadata-value"
                                },
                            },
                        },
                        "repeatedRunGroups": [
                            {
                                "experimentId": str(GlobalID("Experiment", str(2))),
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(4))),
                                        "output": "",
                                    },
                                ],
                            },
                            {
                                "experimentId": str(GlobalID("Experiment", str(1))),
                                "runs": [],
                            },
                            {
                                "experimentId": str(GlobalID("Experiment", str(3))),
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(7))),
                                        "output": "run-7-output-value",
                                    },
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(8))),
                                        "output": 8,
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    "node": {
                        "example": {
                            "id": str(GlobalID("DatasetExample", str(1))),
                            "revision": {
                                "input": {"revision-2-input-key": "revision-2-input-value"},
                                "output": {"revision-2-output-key": "revision-2-output-value"},
                                "metadata": {
                                    "revision-2-metadata-key": "revision-2-metadata-value"
                                },
                            },
                        },
                        "repeatedRunGroups": [
                            {
                                "experimentId": str(GlobalID("Experiment", str(2))),
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(3))),
                                        "output": 3,
                                    },
                                ],
                            },
                            {
                                "experimentId": str(GlobalID("Experiment", str(1))),
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(1))),
                                        "output": {"output": "run-1-output-value"},
                                    },
                                ],
                            },
                            {
                                "experimentId": str(GlobalID("Experiment", str(3))),
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(5))),
                                        "output": None,
                                    },
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(6))),
                                        "output": {"output": "run-6-output-value"},
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        }
    }


@pytest.mark.parametrize(
    "variables, expected_error",
    [
        pytest.param(
            {
                "baseExperimentId": str(GlobalID("Experiment", str(1))),
                "compareExperimentIds": [
                    str(GlobalID("Experiment", str(1))),
                    str(GlobalID("Experiment", str(2))),
                ],
                "first": 50,
                "after": None,
            },
            "Compare experiment IDs cannot contain the base experiment ID",
            id="base-id-in-compare-ids",
        ),
        pytest.param(
            {
                "baseExperimentId": str(GlobalID("Experiment", str(1))),
                "compareExperimentIds": [
                    str(GlobalID("Experiment", str(2))),
                    str(GlobalID("Experiment", str(2))),
                ],
                "first": 50,
                "after": None,
            },
            "Compare experiment IDs must be unique",
            id="duplicate-compare-ids",
        ),
    ],
)
async def test_compare_experiments_validation_errors(
    gql_client: AsyncGraphQLClient,
    variables: dict[str, Any],
    expected_error: str,
) -> None:
    query = """
      query ($baseExperimentId: ID!, $compareExperimentIds: [ID!]!, $first: Int, $after: String) {
        compareExperiments(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
          first: $first
          after: $after
        ) {
          edges {
            node {
              example {
                id
              }
            }
          }
        }
      }
    """

    response = await gql_client.execute(
        query=query,
        variables=variables,
    )
    assert response.errors
    assert len(response.errors) == 1
    assert response.errors[0].message == expected_error


@pytest.mark.skip(reason="TODO: re-enable this test after we figure out the issue with sqlite")
async def test_db_table_stats(gql_client: AsyncGraphQLClient) -> None:
    query = """
      query {
        dbTableStats {
          tableName
          numBytes
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert (data := response.data) is not None
    assert set(s["tableName"] for s in data["dbTableStats"]) == set(models.Base.metadata.tables)


@pytest.fixture
async def prompts_for_filtering(
    db: DbSessionFactory,
) -> None:
    """
    Insert test prompts with different names for testing filtering functionality.
    """
    async with db() as session:
        # Create prompts with different names to test filtering
        prompts = [
            models.Prompt(
                name=Identifier(root="test_prompt_one"),
                description="First test prompt",
                metadata_={"type": "test"},
            ),
            models.Prompt(
                name=Identifier(root="test_prompt_two"),
                description="Second test prompt",
                metadata_={"type": "test"},
            ),
            models.Prompt(
                name=Identifier(root="production_prompt"),
                description="Production prompt",
                metadata_={"type": "production"},
            ),
        ]

        for prompt in prompts:
            session.add(prompt)

        await session.flush()  # Flush to get IDs for creating versions

        # Create a prompt version for each prompt
        for prompt in prompts:
            prompt_version = models.PromptVersion(
                prompt_id=prompt.id,
                description=f"Version for {prompt.name.root}",
                template_type=PromptTemplateType.STRING,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptStringTemplate(type="string", template="Hello, {name}!"),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai", openai=PromptOpenAIInvocationParametersContent()
                ),
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-3.5-turbo",
                metadata_={},
            )
            session.add(prompt_version)

        await session.commit()


@pytest.fixture
async def projects_with_and_without_experiments(
    db: DbSessionFactory,
) -> None:
    """
    Insert two projects, one that contains traces from an experiment and the other that does not.
    """
    async with db() as session:
        await session.scalar(
            insert(models.Project)
            .returning(models.Project.id)
            .values(
                name="non-experiment-project-name",
                description="non-experiment-project-description",
            )
        )
        await session.scalar(
            insert(models.Project)
            .returning(models.Project.id)
            .values(
                name="experiment-project-name",
                description="experiment-project-description",
            )
        )
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(name="dataset-name", metadata_={})
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(dataset_id=dataset_id, metadata_={})
        )
        await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-name",
                repetitions=1,
                metadata_={},
                project_name="experiment-project-name",
            )
        )


async def test_experiment_run_metric_comparisons(
    gql_client: AsyncGraphQLClient,
    experiment_run_metric_comparison_experiments: tuple[
        models.Experiment, tuple[models.Experiment, ...]
    ],
) -> None:
    query = """
      query ($baseExperimentId: ID!, $compareExperimentIds: [ID!]!) {
        experimentRunMetricComparisons(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
        ) {
          latency {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          totalTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          promptTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          completionTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          totalCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          promptCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
          completionCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
            numRunsWithoutComparison
          }
        }
      }
    """
    base_experiment, compare_experiments = experiment_run_metric_comparison_experiments
    variables = {
        "baseExperimentId": str(GlobalID("Experiment", str(base_experiment.id))),
        "compareExperimentIds": [
            str(GlobalID("Experiment", str(experiment.id))) for experiment in compare_experiments
        ],
    }
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert response.data is not None
    assert response.data == {
        "experimentRunMetricComparisons": {
            "latency": {
                "numRunsImproved": 2,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 1,
            },
            "totalTokenCount": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
            "promptTokenCount": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
            "completionTokenCount": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
            "totalCost": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
            "promptCost": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
            "completionCost": {
                "numRunsImproved": 1,
                "numRunsRegressed": 1,
                "numRunsEqual": 1,
                "numRunsWithoutComparison": 2,
            },
        },
    }


@dataclass
class SpanCost:
    total_tokens: Optional[int]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    total_cost: Optional[float]
    prompt_cost: Optional[float]
    completion_cost: Optional[float]


@dataclass
class ExperimentRunMetricValues:
    latency_ms: float
    span_cost: Optional[SpanCost]


@pytest.fixture
async def experiment_run_metric_comparison_experiments(
    db: DbSessionFactory,
) -> tuple[models.Experiment, tuple[models.Experiment, ...]]:
    """
    Creates experiments with the following latency values for each example:

    Example    Base Experiment    Compare Experiment 1    Compare Experiment 2
    -------    ---------------    --------------------    -------------------
    1          1                  2                       2
    2          3                  2                       1
    3          2                  2                       missing
    4          1                  2                       2
    5          3                  missing                 missing

    And the following token and cost values:

    Example    Base Experiment    Compare Experiment 1    Compare Experiment 2
    -------    ---------------    --------------------    -------------------
    1          missing            2                       2
    2          3                  2                       1
    3          2                  2                       missing
    4          1                  2                       2
    5          3                  missing                 missing

    Note these tables are the same, except we test the case of a missing span cost
    for the base experiment. This is because latency is required for any base experiment
    run, but span costs can be missing.
    """
    async with db() as session:
        dataset = models.Dataset(
            name="experiment-run-metric-comparison-dataset",
            description="Dataset for experiment run metric comparison tests",
            metadata_={"test-purpose": "experiment-run-metric-comparison"},
        )
        session.add(dataset)
        await session.flush()

        dataset_version = models.DatasetVersion(
            dataset_id=dataset.id,
            description="version-1-description",
            metadata_={"version-metadata-key": "version-metadata-value"},
        )
        session.add(dataset_version)
        await session.flush()

        examples = []
        for i in range(5):
            example = models.DatasetExample(
                dataset_id=dataset.id,
            )
            session.add(example)
            examples.append(example)
        await session.flush()

        for i, example in enumerate(examples):
            revision = models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=dataset_version.id,
                input={f"example-{i}-input-key": f"example-{i}-input-value"},
                output={f"example-{i}-output-key": f"example-{i}-output-value"},
                metadata_={f"example-{i}-metadata-key": f"example-{i}-metadata-value"},
                revision_kind="CREATE",
            )
            session.add(revision)

        base_experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name="base-experiment",
            description="Base experiment for comparison",
            repetitions=1,
            metadata_={"experiment-type": "base"},
            project_name="test-project",
        )
        session.add(base_experiment)

        compare_experiment_1 = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name="compare-experiment-1",
            description="First comparison experiment",
            repetitions=1,
            metadata_={"experiment-type": "comparison", "version": "1"},
            project_name="test-project",
        )
        session.add(compare_experiment_1)

        compare_experiment_2 = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name="compare-experiment-2",
            description="Second comparison experiment",
            repetitions=1,
            metadata_={"experiment-type": "comparison", "version": "2"},
            project_name="test-project",
        )
        session.add(compare_experiment_2)

        await session.flush()

        project = models.Project(
            name="test-project",
            description="Test project for experiment runs",
        )
        session.add(project)
        await session.flush()

        base_time = datetime(2024, 1, 1, 12, 0, 0)
        base_experiment_run_metric_values: list[Optional[ExperimentRunMetricValues]] = [
            ExperimentRunMetricValues(1, None),
            ExperimentRunMetricValues(3, SpanCost(3, 3, 3, 3, 3, 3)),
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            ExperimentRunMetricValues(1, SpanCost(1, 1, 1, 1, 1, 1)),
            ExperimentRunMetricValues(3, SpanCost(3, 3, 3, 3, 3, 3)),
        ]
        compare_experiment_1_run_metric_values: list[Optional[ExperimentRunMetricValues]] = [
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            None,
        ]
        compare_experiment_2_run_metric_values: list[Optional[ExperimentRunMetricValues]] = [
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            ExperimentRunMetricValues(1, SpanCost(1, 1, 1, 1, 1, 1)),
            None,
            ExperimentRunMetricValues(2, SpanCost(2, 2, 2, 2, 2, 2)),
            None,
        ]

        for i, (example, metric_values) in enumerate(
            zip(examples, base_experiment_run_metric_values)
        ):
            if metric_values is None:
                continue
            start_time = base_time + timedelta(seconds=i * 10)
            end_time = start_time + timedelta(seconds=metric_values.latency_ms)

            trace = models.Trace(
                project_rowid=project.id,
                trace_id=str(uuid.uuid4()),
                start_time=base_time,
                end_time=base_time + timedelta(seconds=50),
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id=f"span-{i}",
                name=f"experiment-run-{i}",
                span_kind="chain",
                start_time=start_time,
                end_time=end_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.flush()

            experiment_run = models.ExperimentRun(
                experiment_id=base_experiment.id,
                dataset_example_id=example.id,
                repetition_number=1,
                output={"result": f"example-{i}-output"},
                start_time=start_time,
                end_time=end_time,
                trace_id=trace.trace_id,
            )
            session.add(experiment_run)

            if metric_values.span_cost is not None:
                span_cost = models.SpanCost(
                    span_rowid=span.id,
                    trace_rowid=trace.id,
                    span_start_time=start_time,
                    total_tokens=metric_values.span_cost.total_tokens,
                    prompt_tokens=metric_values.span_cost.prompt_tokens,
                    completion_tokens=metric_values.span_cost.completion_tokens,
                    total_cost=metric_values.span_cost.total_cost,
                    prompt_cost=metric_values.span_cost.prompt_cost,
                    completion_cost=metric_values.span_cost.completion_cost,
                )
                session.add(span_cost)

        for i, (example, metric_values) in enumerate(
            zip(examples, compare_experiment_1_run_metric_values)
        ):
            if metric_values is None:
                continue
            start_time = base_time + timedelta(seconds=i * 10)
            end_time = start_time + timedelta(seconds=metric_values.latency_ms)

            trace = models.Trace(
                project_rowid=project.id,
                trace_id=str(uuid.uuid4()),
                start_time=base_time,
                end_time=base_time + timedelta(seconds=50),
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id=f"span-compare1-{i}",
                name=f"compare1-experiment-run-{i}",
                span_kind="chain",
                start_time=start_time,
                end_time=end_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.flush()

            experiment_run = models.ExperimentRun(
                experiment_id=compare_experiment_1.id,
                dataset_example_id=example.id,
                repetition_number=1,
                output={"result": f"example-{i}-output"},
                start_time=start_time,
                end_time=end_time,
                trace_id=trace.trace_id,
            )
            session.add(experiment_run)

            if metric_values.span_cost is not None:
                span_cost = models.SpanCost(
                    span_rowid=span.id,
                    trace_rowid=trace.id,
                    span_start_time=start_time,
                    total_tokens=metric_values.span_cost.total_tokens,
                    prompt_tokens=metric_values.span_cost.prompt_tokens,
                    completion_tokens=metric_values.span_cost.completion_tokens,
                    total_cost=metric_values.span_cost.total_cost,
                    prompt_cost=metric_values.span_cost.prompt_cost,
                    completion_cost=metric_values.span_cost.completion_cost,
                )
                session.add(span_cost)

        for i, (example, metric_values) in enumerate(
            zip(examples, compare_experiment_2_run_metric_values)
        ):
            if metric_values is None:
                continue
            start_time = base_time + timedelta(seconds=i * 10)
            end_time = start_time + timedelta(seconds=metric_values.latency_ms)

            trace = models.Trace(
                project_rowid=project.id,
                trace_id=str(uuid.uuid4()),
                start_time=base_time,
                end_time=base_time + timedelta(seconds=50),
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id=f"span-compare2-{i}",
                name=f"compare2-experiment-run-{i}",
                span_kind="chain",
                start_time=start_time,
                end_time=end_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.flush()

            experiment_run = models.ExperimentRun(
                experiment_id=compare_experiment_2.id,
                dataset_example_id=example.id,
                repetition_number=1,
                output={"result": f"example-{i}-output"},
                start_time=start_time,
                end_time=end_time,
                trace_id=trace.trace_id,
            )
            session.add(experiment_run)

            if metric_values.span_cost is not None:
                span_cost = models.SpanCost(
                    span_rowid=span.id,
                    trace_rowid=trace.id,
                    span_start_time=start_time,
                    total_tokens=metric_values.span_cost.total_tokens,
                    prompt_tokens=metric_values.span_cost.prompt_tokens,
                    completion_tokens=metric_values.span_cost.completion_tokens,
                    total_cost=metric_values.span_cost.total_cost,
                    prompt_cost=metric_values.span_cost.prompt_cost,
                    completion_cost=metric_values.span_cost.completion_cost,
                )
                session.add(span_cost)

        await session.commit()

        return base_experiment, (compare_experiment_1, compare_experiment_2)


async def test_secrets_pagination(
    gql_client: AsyncGraphQLClient,
    secrets_for_pagination: Any,
) -> None:
    """Test that secrets query supports pagination and keys filter correctly."""
    query = """
      query ($first: Int, $after: String, $keys: [String!]) {
        secrets(first: $first, after: $after, keys: $keys) {
          edges {
            secret: node {
              id
              key
              value {
                ... on DecryptedSecret {
                  value
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    """

    # ===== PAGINATION TESTS =====

    # Test first page with limit of 2
    response = await gql_client.execute(
        query=query,
        variables={"first": 2, "after": None},
    )
    assert not response.errors
    assert response.data is not None
    first_page = response.data["secrets"]
    first_page_secrets = [
        (edge["secret"]["key"], edge["secret"]["value"]["value"]) for edge in first_page["edges"]
    ]
    assert first_page_secrets == [("secret-a", "value-a"), ("secret-b", "value-b")]
    assert first_page["pageInfo"]["hasNextPage"] is True
    assert first_page["pageInfo"]["hasPreviousPage"] is False

    # Test second page
    after_cursor = first_page["pageInfo"]["endCursor"]
    response = await gql_client.execute(
        query=query,
        variables={"first": 2, "after": after_cursor},
    )
    assert not response.errors
    assert response.data is not None
    second_page = response.data["secrets"]
    second_page_secrets = [
        (edge["secret"]["key"], edge["secret"]["value"]["value"]) for edge in second_page["edges"]
    ]
    assert second_page_secrets == [("secret-c", "value-c"), ("secret-d", "value-d")]
    assert second_page["pageInfo"]["hasNextPage"] is True
    assert second_page["pageInfo"]["hasPreviousPage"] is True

    # Test third page (last page)
    after_cursor = second_page["pageInfo"]["endCursor"]
    response = await gql_client.execute(
        query=query,
        variables={"first": 2, "after": after_cursor},
    )
    assert not response.errors
    assert response.data is not None
    third_page = response.data["secrets"]
    third_page_secrets = [
        (edge["secret"]["key"], edge["secret"]["value"]["value"]) for edge in third_page["edges"]
    ]
    assert third_page_secrets == [("secret-e", "value-e"), ("secret-f", "value-f")]
    assert third_page["pageInfo"]["hasNextPage"] is False
    assert third_page["pageInfo"]["hasPreviousPage"] is True

    # ===== KEYS FILTER TESTS =====

    # Test filtering by specific keys
    response = await gql_client.execute(
        query=query,
        variables={"first": 10, "keys": ["secret-a", "secret-c", "secret-e"]},
    )
    assert not response.errors
    assert response.data is not None
    filtered_secrets = [
        (edge["secret"]["key"], edge["secret"]["value"]["value"])
        for edge in response.data["secrets"]["edges"]
    ]
    assert filtered_secrets == [
        ("secret-a", "value-a"),
        ("secret-c", "value-c"),
        ("secret-e", "value-e"),
    ]

    # Test filtering with non-existent keys (should return empty)
    response = await gql_client.execute(
        query=query,
        variables={"first": 10, "keys": ["nonexistent-key"]},
    )
    assert not response.errors
    assert response.data is not None
    assert response.data["secrets"]["edges"] == []

    # Test filtering with mix of existing and non-existent keys
    response = await gql_client.execute(
        query=query,
        variables={"first": 10, "keys": ["secret-b", "nonexistent-key"]},
    )
    assert not response.errors
    assert response.data is not None
    mixed_secrets = [
        (edge["secret"]["key"], edge["secret"]["value"]["value"])
        for edge in response.data["secrets"]["edges"]
    ]
    assert mixed_secrets == [("secret-b", "value-b")]


@pytest.fixture
async def secrets_for_pagination(db: DbSessionFactory) -> None:
    """
    Creates multiple secrets for testing pagination and filtering.
    Creates 6 secrets for pagination tests.
    """
    encryption = EncryptionService()
    secrets = [
        models.Secret(key="secret-a", value=encryption.encrypt(b"value-a")),
        models.Secret(key="secret-b", value=encryption.encrypt(b"value-b")),
        models.Secret(key="secret-c", value=encryption.encrypt(b"value-c")),
        models.Secret(key="secret-d", value=encryption.encrypt(b"value-d")),
        models.Secret(key="secret-e", value=encryption.encrypt(b"value-e")),
        models.Secret(key="secret-f", value=encryption.encrypt(b"value-f")),
    ]
    async with db() as session:
        session.add_all(secrets)


@pytest.fixture
async def comparison_experiments(db: DbSessionFactory) -> None:
    """
    Creates a dataset with four examples, three versions, and four experiments.

                Version 1   Version 2   Version 3
    Example 1   CREATED     PATCHED     PATCHED
    Example 2               CREATED
    Example 3   CREATED     DELETED
    Example 4                           CREATED

    Experiment 1: V1 (1 repetition)
    Experiment 2: V2 (1 repetition)
    Experiment 3: V3 (2 repetitions)
    Experiment 4: V3 (1 repetition)
    """

    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(
                name="dataset-name",
                description="dataset-description",
                metadata_={"dataset-metadata-key": "dataset-metadata-value"},
            )
        )

        example_ids = (
            await session.scalars(
                insert(models.DatasetExample)
                .returning(models.DatasetExample.id)
                .values([{"dataset_id": dataset_id} for _ in range(4)])
            )
        ).all()

        version_ids = (
            await session.scalars(
                insert(models.DatasetVersion)
                .returning(models.DatasetVersion.id)
                .values(
                    [
                        {
                            "dataset_id": dataset_id,
                            "description": f"version-{index}-description",
                            "metadata_": {
                                f"version-{index}-metadata-key": f"version-{index}-metadata-value"
                            },
                        }
                        for index in range(1, 4)
                    ]
                )
            )
        ).all()

        await session.scalars(
            insert(models.DatasetExampleRevision)
            .returning(models.DatasetExampleRevision.id)
            .values(
                [
                    {
                        **revision,
                        "input": {
                            f"revision-{revision_index + 1}-input-key": f"revision-{revision_index + 1}-input-value"
                        },
                        "output": {
                            f"revision-{revision_index + 1}-output-key": f"revision-{revision_index + 1}-output-value"
                        },
                        "metadata_": {
                            f"revision-{revision_index + 1}-metadata-key": f"revision-{revision_index + 1}-metadata-value"
                        },
                    }
                    for revision_index, revision in enumerate(
                        [
                            {
                                "dataset_example_id": example_ids[0],
                                "dataset_version_id": version_ids[0],
                                "revision_kind": "CREATE",
                            },
                            {
                                "dataset_example_id": example_ids[0],
                                "dataset_version_id": version_ids[1],
                                "revision_kind": "PATCH",
                            },
                            {
                                "dataset_example_id": example_ids[0],
                                "dataset_version_id": version_ids[2],
                                "revision_kind": "PATCH",
                            },
                            {
                                "dataset_example_id": example_ids[1],
                                "dataset_version_id": version_ids[1],
                                "revision_kind": "CREATE",
                            },
                            {
                                "dataset_example_id": example_ids[2],
                                "dataset_version_id": version_ids[0],
                                "revision_kind": "CREATE",
                            },
                            {
                                "dataset_example_id": example_ids[2],
                                "dataset_version_id": version_ids[1],
                                "revision_kind": "DELETE",
                            },
                            {
                                "dataset_example_id": example_ids[3],
                                "dataset_version_id": version_ids[2],
                                "revision_kind": "CREATE",
                            },
                        ]
                    )
                ]
            )
        )

        experiment_ids = (
            await session.scalars(
                insert(models.Experiment)
                .returning(models.Experiment.id)
                .values(
                    [
                        {
                            **experiment,
                            "name": f"experiment-{experiment_index + 1}-name",
                            "description": f"experiment-{experiment_index + 1}-description",
                            "repetitions": 1,
                            "metadata_": {
                                f"experiment-{experiment_index + 1}-metadata-key": f"experiment-{experiment_index + 1}-metadata-value"
                            },
                        }
                        for experiment_index, experiment in enumerate(
                            [
                                {
                                    "dataset_id": dataset_id,
                                    "dataset_version_id": version_ids[0],
                                },
                                {
                                    "dataset_id": dataset_id,
                                    "dataset_version_id": version_ids[1],
                                },
                                {
                                    "dataset_id": dataset_id,
                                    "dataset_version_id": version_ids[2],
                                },
                                {
                                    "dataset_id": dataset_id,
                                    "dataset_version_id": version_ids[0],
                                },
                            ]
                        )
                    ]
                )
            )
        ).all()

        await session.scalars(
            insert(models.ExperimentRun)
            .returning(models.ExperimentRun.id)
            .values(
                [
                    {
                        **run,
                        "output": [
                            {"task_output": {"output": f"run-{run_index + 1}-output-value"}},
                            {"task_output": f"run-{run_index + 1}-output-value"},
                            {"task_output": run_index + 1},
                            {"task_output": ""},
                            {},
                        ][run_index % 5],
                    }
                    for run_index, run in enumerate(
                        [
                            {
                                "experiment_id": experiment_ids[0],
                                "dataset_example_id": example_ids[0],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[0],
                                "dataset_example_id": example_ids[3],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[1],
                                "dataset_example_id": example_ids[0],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[1],
                                "dataset_example_id": example_ids[1],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[2],
                                "dataset_example_id": example_ids[0],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[2],
                                "dataset_example_id": example_ids[0],
                                "trace_id": None,
                                "repetition_number": 2,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[2],
                                "dataset_example_id": example_ids[1],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[2],
                                "dataset_example_id": example_ids[1],
                                "trace_id": None,
                                "repetition_number": 2,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[3],
                                "dataset_example_id": example_ids[0],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[3],
                                "dataset_example_id": example_ids[1],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                            {
                                "experiment_id": experiment_ids[3],
                                "dataset_example_id": example_ids[3],
                                "trace_id": None,
                                "repetition_number": 1,
                                "start_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "end_time": datetime(
                                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                                ),
                                "error": None,
                            },
                        ]
                    )
                ]
            )
        )

        # Create ExperimentDatasetExample snapshot entries
        # This simulates what insert_experiment_with_examples_snapshot() does
        await session.execute(
            insert(models.ExperimentDatasetExample).values(
                [
                    # Experiment 1 (V1): examples 1 and 4
                    {
                        "experiment_id": experiment_ids[0],
                        "dataset_example_id": example_ids[0],
                        "dataset_example_revision_id": 1,  # revision 1 for example 1
                    },
                    {
                        "experiment_id": experiment_ids[0],
                        "dataset_example_id": example_ids[3],
                        "dataset_example_revision_id": 7,  # revision 7 for example 4
                    },
                    # Experiment 2 (V2): examples 1 and 2
                    {
                        "experiment_id": experiment_ids[1],
                        "dataset_example_id": example_ids[0],
                        "dataset_example_revision_id": 2,  # revision 2 for example 1
                    },
                    {
                        "experiment_id": experiment_ids[1],
                        "dataset_example_id": example_ids[1],
                        "dataset_example_revision_id": 4,  # revision 4 for example 2
                    },
                    # Experiment 3 (V3): examples 1 and 2
                    {
                        "experiment_id": experiment_ids[2],
                        "dataset_example_id": example_ids[0],
                        "dataset_example_revision_id": 3,  # revision 3 for example 1
                    },
                    {
                        "experiment_id": experiment_ids[2],
                        "dataset_example_id": example_ids[1],
                        "dataset_example_revision_id": 4,  # revision 4 for example 2
                    },
                    # Experiment 4 (V1): examples 1, 2, and 4
                    {
                        "experiment_id": experiment_ids[3],
                        "dataset_example_id": example_ids[0],
                        "dataset_example_revision_id": 1,  # revision 1 for example 1
                    },
                    {
                        "experiment_id": experiment_ids[3],
                        "dataset_example_id": example_ids[1],
                        "dataset_example_revision_id": 4,  # revision 4 for example 2
                    },
                    {
                        "experiment_id": experiment_ids[3],
                        "dataset_example_id": example_ids[3],
                        "dataset_example_revision_id": 7,  # revision 7 for example 4
                    },
                ]
            )
        )

        await session.commit()
