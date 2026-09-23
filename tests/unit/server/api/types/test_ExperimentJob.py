from datetime import datetime, timedelta
from typing import NamedTuple

import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluator_definition import (
    EvaluatorSource,
    InlineCodeEvaluatorDefinition,
    InlineLLMEvaluatorDefinition,
    InlineLLMEvaluatorPromptVersion,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    TextContentPart,
)
from phoenix.server.api.types.ExperimentJob import ExperimentJob
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

QUERY = """
  query ($jobId: ID!) {
    node(id: $jobId) {
      ... on ExperimentJob {
        lastError {
          message
          level
        }
        errors {
          edges {
            node {
              message
              level
            }
          }
        }
      }
    }
  }
"""


class ExperimentWithLogs(NamedTuple):
    experiment_id: int


@pytest.fixture
async def experiment_with_logs(db: DbSessionFactory) -> ExperimentWithLogs:
    """Create a dataset, experiment, experiment_job, and several experiment logs."""
    t0 = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="ds", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="exp1",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        await session.execute(
            insert(models.ExperimentJob).values(
                id=experiment_id,
                type="PROMPT",
                status="COMPLETED",
            )
        )
        # Three ERROR logs at different times, plus one INFO log that is newest.
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0,
                category="EXPERIMENT",
                level="ERROR",
                message="old error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=2),
                category="EXPERIMENT",
                level="ERROR",
                message="newest error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=1),
                category="EXPERIMENT",
                level="ERROR",
                message="middle error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=10),
                category="EXPERIMENT",
                level="INFO",
                message="info log that is newest overall",
            )
        )
        await session.commit()
    assert experiment_id is not None
    return ExperimentWithLogs(experiment_id=experiment_id)


async def test_experiment_job_last_error_and_errors(
    gql_client: AsyncGraphQLClient,
    experiment_with_logs: ExperimentWithLogs,
) -> None:
    job_id = str(
        GlobalID(type_name=ExperimentJob.__name__, node_id=str(experiment_with_logs.experiment_id))
    )
    response = await gql_client.execute(query=QUERY, variables={"jobId": job_id})
    assert not response.errors
    assert response.data is not None
    node = response.data["node"]

    # lastError should be the most recent ERROR, ignoring the newer INFO log
    assert node["lastError"] == {"message": "newest error", "level": "ERROR"}

    # errors should return only ERROR-level logs, most recent first
    messages = [edge["node"]["message"] for edge in node["errors"]["edges"]]
    assert messages == ["newest error", "middle error", "old error"]
    for edge in node["errors"]["edges"]:
        assert edge["node"]["level"] == "ERROR"


TASK_CONFIG_QUERY = """
  query ($jobId: ID!) {
    node(id: $jobId) {
      ... on ExperimentJob {
        taskConfig {
          __typename
          ... on PromptTaskConfig {
            id
          }
          ... on EvaluatorTaskConfig {
            id
            name
            evaluatorKind
            inputMapping {
              literalMapping
              pathMapping
            }
            outputConfigs {
              ... on ContinuousAnnotationConfig {
                id
                name
                lowerBound
                upperBound
              }
              ... on CategoricalAnnotationConfig {
                id
                name
              }
            }
            definition {
              __typename
              ... on InlineCodeEvaluatorDefinition {
                name
                language
                sourceCode
                sandboxConfigId
                outputConfigs {
                  ... on ContinuousAnnotationConfig {
                    id
                    name
                  }
                }
                source {
                  evaluatorId
                }
              }
              ... on InlineLLMEvaluatorDefinition {
                name
                description
                modelProvider
                modelName
                templateFormat
                template {
                  ... on PromptChatTemplate {
                    messages {
                      role
                      content {
                        ... on TextContentPart {
                          text {
                            text
                          }
                        }
                      }
                    }
                  }
                }
                outputConfigs {
                  ... on CategoricalAnnotationConfig {
                    id
                    name
                  }
                }
                source {
                  evaluatorId
                  promptVersionId
                  datasetEvaluatorId
                  projectEvaluatorId
                }
              }
            }
          }
        }
      }
    }
  }
"""

_ANSWER_LENGTH_SOURCE = "def evaluate(output):\n    return len(output)"


@pytest.fixture
async def evaluator_experiment_job_id(db: DbSessionFactory) -> int:
    """An experiment whose task is an inline code evaluator."""
    length_config = ContinuousOutputConfig(
        type="CONTINUOUS",
        name="length",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description=None,
        lower_bound=0.0,
        upper_bound=None,
    )
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="ds", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="answer-length",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        assert experiment_id is not None
        session.add(
            models.ExperimentEvaluatorTask(
                id=experiment_id,
                name=Identifier("answer-length"),
                evaluator_kind="CODE",
                definition=InlineCodeEvaluatorDefinition(
                    type="inline_code_evaluator",
                    name="answer-length",
                    description=None,
                    language="PYTHON",
                    source_code=_ANSWER_LENGTH_SOURCE,
                    sandbox_config_id=7,
                    output_configs=[length_config],
                ),
                input_mapping=InputMapping(
                    literal_mapping={"case_sensitive": True},
                    path_mapping={"output": "$.output"},
                ),
                output_configs=[length_config],
            )
        )
        await session.commit()
    return experiment_id


async def test_evaluator_job_exposes_its_evaluator_task_config(
    gql_client: AsyncGraphQLClient,
    evaluator_experiment_job_id: int,
) -> None:
    job_id = str(
        GlobalID(type_name=ExperimentJob.__name__, node_id=str(evaluator_experiment_job_id))
    )
    response = await gql_client.execute(query=TASK_CONFIG_QUERY, variables={"jobId": job_id})
    assert not response.errors
    assert response.data is not None
    node = response.data["node"]

    config = node["taskConfig"]
    assert config["__typename"] == "EvaluatorTaskConfig"
    assert config["name"] == "answer-length"
    assert config["evaluatorKind"] == "CODE"
    assert config["inputMapping"] == {
        "literalMapping": {"case_sensitive": True},
        "pathMapping": {"output": "$.output"},
    }
    (config_output,) = config["outputConfigs"]
    assert {key: value for key, value in config_output.items() if key != "id"} == {
        "name": "length",
        "lowerBound": 0.0,
        "upperBound": None,
    }
    definition = config["definition"]
    assert definition["__typename"] == "InlineCodeEvaluatorDefinition"
    assert definition["name"] == "answer-length"
    assert definition["language"] == "PYTHON"
    assert definition["sourceCode"] == _ANSWER_LENGTH_SOURCE
    assert definition["sandboxConfigId"] == str(GlobalID("SandboxConfig", "7"))
    assert [output["name"] for output in definition["outputConfigs"]] == ["length"]
    assert config_output["id"] != definition["outputConfigs"][0]["id"]
    assert definition["source"] is None


@pytest.fixture
async def llm_evaluator_experiment_job_id(db: DbSessionFactory) -> int:
    """An experiment whose task is an inline LLM evaluator opened from a saved evaluator."""
    tone_config = CategoricalOutputConfig(
        type="CATEGORICAL",
        name="tone",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description=None,
        values=[CategoricalAnnotationValue(label="warm", score=1.0)],
    )
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="tone-ds", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="tone",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        assert experiment_id is not None
        session.add(
            models.ExperimentEvaluatorTask(
                id=experiment_id,
                name=Identifier("tone"),
                evaluator_kind="LLM",
                definition=InlineLLMEvaluatorDefinition(
                    type="inline_llm_evaluator",
                    name="tone",
                    description="judges tone",
                    prompt_version=InlineLLMEvaluatorPromptVersion(
                        template_format="F_STRING",
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[TextContentPart(type="text", text="Judge {output}")],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(temperature=0.0),
                        ),
                        model_provider="OPENAI",
                        model_name="gpt-4o",
                    ),
                    output_configs=[tone_config],
                    source=EvaluatorSource(evaluator_id=3, prompt_version_id=4),
                ),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[tone_config],
            )
        )
        await session.commit()
    return experiment_id


async def test_llm_evaluator_job_exposes_its_frozen_judge_prompt(
    gql_client: AsyncGraphQLClient,
    llm_evaluator_experiment_job_id: int,
) -> None:
    job_id = str(
        GlobalID(type_name=ExperimentJob.__name__, node_id=str(llm_evaluator_experiment_job_id))
    )
    response = await gql_client.execute(query=TASK_CONFIG_QUERY, variables={"jobId": job_id})
    assert not response.errors
    assert response.data is not None

    definition = response.data["node"]["taskConfig"]["definition"]
    assert definition["__typename"] == "InlineLLMEvaluatorDefinition"
    assert definition["name"] == "tone"
    assert definition["description"] == "judges tone"
    assert definition["modelProvider"] == "OPENAI"
    assert definition["modelName"] == "gpt-4o"
    assert definition["templateFormat"] == "F_STRING"
    assert definition["template"]["messages"] == [
        {"role": "USER", "content": [{"text": {"text": "Judge {output}"}}]}
    ]
    assert [output["name"] for output in definition["outputConfigs"]] == ["tone"]
    task_config = response.data["node"]["taskConfig"]
    assert [output["name"] for output in task_config["outputConfigs"]] == ["tone"]
    assert task_config["outputConfigs"][0]["id"] != definition["outputConfigs"][0]["id"]
    assert definition["source"] == {
        "evaluatorId": str(GlobalID("LLMEvaluator", "3")),
        "promptVersionId": str(GlobalID("PromptVersion", "4")),
        "datasetEvaluatorId": None,
        "projectEvaluatorId": None,
    }


async def test_job_without_a_task_has_no_task_config(
    gql_client: AsyncGraphQLClient,
    experiment_with_logs: ExperimentWithLogs,
) -> None:
    job_id = str(
        GlobalID(type_name=ExperimentJob.__name__, node_id=str(experiment_with_logs.experiment_id))
    )
    response = await gql_client.execute(query=TASK_CONFIG_QUERY, variables={"jobId": job_id})
    assert not response.errors
    assert response.data is not None
    assert response.data["node"]["taskConfig"] is None


async def test_a_job_loaded_through_its_experiment_resolves_its_task_config(
    gql_client: AsyncGraphQLClient,
    llm_evaluator_experiment_job_id: int,
) -> None:
    experiment_id = str(GlobalID("Experiment", str(llm_evaluator_experiment_job_id)))
    response = await gql_client.execute(
        query="""
          query ($experimentId: ID!) {
            node(id: $experimentId) {
              ... on Experiment {
                job {
                  taskConfig {
                    __typename
                  }
                }
              }
            }
          }
        """,
        variables={"experimentId": experiment_id},
    )
    assert not response.errors
    assert response.data is not None
    assert response.data["node"]["job"]["taskConfig"] == {"__typename": "EvaluatorTaskConfig"}
