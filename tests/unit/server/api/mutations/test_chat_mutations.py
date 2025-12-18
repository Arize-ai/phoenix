import re
from typing import Awaitable, Callable

from sqlalchemy import select
from strawberry.relay import GlobalID
from vcr.request import Request

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import LLMEvaluator
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.experiments.utils import is_experiment_project_name
from phoenix.server.types import DbSessionFactory

from ....graphql import AsyncGraphQLClient
from ....vcr import CustomVCR


class TestChatCompletionMutationMixin:
    async def test_chat_completion(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        """Test basic chat completion mutation without a dataset."""
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                toolCalls {
                  id
                  function {
                    name
                    arguments
                  }
                }
                span {
                  cumulativeTokenCountTotal
                  input {
                    value
                  }
                  output {
                    value
                  }
                  trace {
                    project {
                      name
                    }
                  }
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-4",
                    }
                },
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is the capital of France? Answer in one word.",
                    }
                ],
                "repetitions": 1,
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletion")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletion"])
            assert (repetitions := field["repetitions"])
            assert len(repetitions) == 1

            repetition = repetitions[0]
            assert repetition["repetitionNumber"] == 1
            assert not repetition["errorMessage"]
            assert repetition["content"]  # Should have content (e.g., "Paris")
            assert repetition["span"]["input"]["value"]
            assert repetition["span"]["output"]["value"]
            assert repetition["span"]["cumulativeTokenCountTotal"]
            # Verify the span is in the playground project
            assert repetition["span"]["trace"]["project"]["name"] == PLAYGROUND_PROJECT_NAME

    async def test_chat_completion_with_multiple_repetitions(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        """Test chat completion with multiple repetitions."""
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                span {
                  cumulativeTokenCountTotal
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-4",
                    }
                },
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is 2 + 2? Answer with just the number.",
                    }
                ],
                "repetitions": 2,
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletion")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletion"])
            assert (repetitions := field["repetitions"])
            assert len(repetitions) == 2

            for i, repetition in enumerate(repetitions, start=1):
                assert repetition["repetitionNumber"] == i
                assert not repetition["errorMessage"]
                assert repetition["content"]
                assert repetition["span"]["cumulativeTokenCountTotal"]

    async def test_chat_completion_over_dataset(
        self,
        gql_client: AsyncGraphQLClient,
        playground_dataset_with_patch_revision: None,
        custom_vcr: CustomVCR,
    ) -> None:
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        dataset_version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
                repetition {
                  content
                  errorMessage
                  span {
                    cumulativeTokenCountTotal
                    input {
                      value
                    }
                    output {
                      value
                    }
                    trace {
                      project {
                        name
                      }
                    }
                  }
                }
              }
            }
          }

          query GetExperiment($experimentId: ID!) {
            experiment: node(id: $experimentId) {
              ... on Experiment {
                projectName
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-4",
                        "credentials": [{"envVarName": "OPENAI_API_KEY", "value": "sk-"}],
                    }
                },
                "datasetId": dataset_id,
                "datasetVersionId": dataset_version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
            }
        }
        custom_vcr.register_matcher(
            _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
        )  # a custom request matcher is needed since the requests are concurrent
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])
            assert field["datasetId"] == dataset_id
            assert field["datasetVersionId"] == dataset_version_id
            assert (examples := field["examples"])
            common_project_name = None
            for i, example in enumerate(examples, 1):
                assert example["datasetExampleId"] == str(
                    GlobalID(type_name=DatasetExample.__name__, node_id=str(i))
                )
                assert example["experimentRunId"] == str(
                    GlobalID(type_name=ExperimentRun.__name__, node_id=str(i))
                )
                assert (repetition := example["repetition"])
                if repetition["errorMessage"]:
                    assert repetition["errorMessage"]
                    continue
                assert repetition["content"]
                assert repetition["span"]["input"]["value"]
                assert repetition["span"]["output"]["value"]
                assert repetition["span"]["cumulativeTokenCountTotal"]
                project_name = repetition["span"]["trace"]["project"]["name"]
                assert is_experiment_project_name(project_name)
                if common_project_name:
                    assert project_name == common_project_name
                common_project_name = project_name

        result = await gql_client.execute(
            query, {"experimentId": field["experimentId"]}, "GetExperiment"
        )
        assert not result.errors
        assert (data := result.data)
        assert (field := data["experiment"])
        assert field["projectName"] == common_project_name

    async def test_chat_completion_over_dataset_with_single_split(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that providing a single split ID filters examples correctly."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        dataset_version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        train_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(1)))

        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": dataset_version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "splitIds": [train_split_id],  # Only train split
                "repetitions": 1,
            }
        }

        custom_vcr.register_matcher(
            _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
        )
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])

            # Should only have examples 1, 2, 3 (train split)
            assert len(field["examples"]) == 3
            train_example_ids = [
                str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i)))
                for i in range(1, 4)
            ]
            example_ids = [ex["datasetExampleId"] for ex in field["examples"]]
            assert set(example_ids) == set(train_example_ids)

            # Verify experiment has the correct split association in DB
            experiment_id = field["experimentId"]
            async with db() as session:
                from phoenix.server.api.types.node import from_global_id

                _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
                db_result = await session.execute(
                    select(models.ExperimentDatasetSplit).where(
                        models.ExperimentDatasetSplit.experiment_id == exp_id
                    )
                )
                split_links = db_result.scalars().all()
                assert len(split_links) == 1
                assert split_links[0].dataset_split_id == 1  # train split

    async def test_chat_completion_over_dataset_with_multiple_splits(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that providing multiple split IDs includes examples from all specified splits."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        dataset_version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        train_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(1)))
        test_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(2)))

        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": dataset_version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "splitIds": [train_split_id, test_split_id],  # Both splits
                "repetitions": 1,
            }
        }

        custom_vcr.register_matcher(
            _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
        )
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])

            # Should have all examples 1-5
            assert len(field["examples"]) == 5
            all_example_ids = [
                str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i)))
                for i in range(1, 6)
            ]
            example_ids = [ex["datasetExampleId"] for ex in field["examples"]]
            assert set(example_ids) == set(all_example_ids)

            # Verify experiment has both split associations in DB
            experiment_id = field["experimentId"]
            async with db() as session:
                from phoenix.server.api.types.node import from_global_id

                _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
                db_result = await session.execute(
                    select(models.ExperimentDatasetSplit)
                    .where(models.ExperimentDatasetSplit.experiment_id == exp_id)
                    .order_by(models.ExperimentDatasetSplit.dataset_split_id)
                )
                split_links = db_result.scalars().all()
                assert len(split_links) == 2
                assert split_links[0].dataset_split_id == 1  # train split
                assert split_links[1].dataset_split_id == 2  # test split

    async def test_chat_completion_over_dataset_without_splits(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test backward compatibility: when no splits are specified, all examples are included."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        dataset_version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))

        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": dataset_version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                # No splitIds provided
                "repetitions": 1,
            }
        }

        custom_vcr.register_matcher(
            _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
        )
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])

            # Should have all examples 1-5
            assert len(field["examples"]) == 5
            all_example_ids = [
                str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i)))
                for i in range(1, 6)
            ]
            example_ids = [ex["datasetExampleId"] for ex in field["examples"]]
            assert set(example_ids) == set(all_example_ids)

            # Verify experiment has NO split associations in DB
            experiment_id = field["experimentId"]
            async with db() as session:
                from phoenix.server.api.types.node import from_global_id

                _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
                db_result = await session.execute(
                    select(models.ExperimentDatasetSplit).where(
                        models.ExperimentDatasetSplit.experiment_id == exp_id
                    )
                )
                split_links = db_result.scalars().all()
                assert len(split_links) == 0  # No splits associated

    async def test_evaluator_returns_evaluation_and_persists_span_annotation(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that chat_completion mutation with evaluator returns evaluations and persists
        span annotations."""
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(correctness_llm_evaluator.id))
        )
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                evaluations {
                  name
                  label
                  score
                  explanation
                  annotatorKind
                }
                span {
                  id
                  cumulativeTokenCountTotal
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4o-mini"}},
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is 2 + 2? Answer with just the number.",
                    }
                ],
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.0},
                ],
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletion")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletion"])
            assert (repetitions := field["repetitions"])
            assert len(repetitions) == 1

            repetition = repetitions[0]
            assert repetition["repetitionNumber"] == 1
            assert not repetition["errorMessage"]
            assert "4" in repetition["content"]
            assert repetition["span"]["cumulativeTokenCountTotal"]

            # Verify evaluations are returned
            assert (evaluations := repetition["evaluations"])
            assert len(evaluations) == 1
            eval_result = evaluations[0]
            assert eval_result["name"] == "correctness"
            assert eval_result["annotatorKind"] == "LLM"
            assert eval_result["label"] == "correct"

        # Verify span annotation was persisted in DB
        async with db() as session:
            result = await session.execute(select(models.SpanAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 1

            annotation = annotations[0]
            assert annotation.name == "correctness"
            assert annotation.annotator_kind == "LLM"
            assert annotation.label == "correct"

    async def test_evaluator_not_run_when_task_errors(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that evaluators are not run when the chat completion errors out."""
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(correctness_llm_evaluator.id))
        )
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                evaluations {
                  name
                  label
                  score
                }
                span {
                  id
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-nonexistent-model",  # use a non-existent model to trigger an error
                    }
                },
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is 2 + 2?",
                    }
                ],
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletion")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletion"])
            assert (repetitions := field["repetitions"])
            assert len(repetitions) == 1

            repetition = repetitions[0]
            assert repetition["errorMessage"]  # verify the task errored out
            assert repetition["content"] is None

            assert repetition["evaluations"] == []  # verify no evaluations were run

        async with db() as session:
            result = await session.execute(select(models.SpanAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 0  # verify no span annotations were persisted

    async def test_evaluator_over_dataset_returns_evaluations_and_persists_annotations(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_correctness_llm_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that chat_completion_over_dataset mutation with evaluator returns evaluations
        and persists experiment run annotations."""
        dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(dataset_evaluator.evaluator_id))
        )

        # Get dataset version ID
        async with db() as session:
            version_id = await session.scalar(
                select(models.DatasetVersion.id).where(
                    models.DatasetVersion.dataset_id == single_example_dataset.id
                )
            )
        dataset_gid = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        version_gid = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(version_id)))

        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
                repetition {
                  content
                  errorMessage
                  evaluations {
                    name
                    label
                    score
                    annotatorKind
                  }
                  span {
                    id
                    cumulativeTokenCountTotal
                  }
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_gid,
                "datasetVersionId": version_gid,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            }
        }

        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])
            assert (examples := field["examples"])
            assert len(examples) == 1

            example = examples[0]
            repetition = example["repetition"]
            assert not repetition["errorMessage"]
            assert repetition["content"]  # Should have content like "France"

            # Verify evaluations are returned
            assert (evaluations := repetition["evaluations"])
            assert len(evaluations) == 1
            eval_result = evaluations[0]
            assert eval_result["name"] == "correctness"
            assert eval_result["annotatorKind"] == "LLM"

        # Verify experiment run annotation was persisted in DB
        async with db() as session:
            result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 1

            annotation = annotations[0]
            assert annotation.name == "correctness"
            assert annotation.annotator_kind == "LLM"
            assert annotation.experiment_run_id is not None

    async def test_evaluator_over_dataset_not_run_when_task_errors(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_correctness_llm_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that evaluators are not run when the chat completion over dataset task errors."""
        dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(dataset_evaluator.evaluator_id))
        )

        # Get dataset version ID
        async with db() as session:
            version_id = await session.scalar(
                select(models.DatasetVersion.id).where(
                    models.DatasetVersion.dataset_id == single_example_dataset.id
                )
            )
        dataset_gid = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        version_gid = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(version_id)))

        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              datasetVersionId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
                repetition {
                  content
                  errorMessage
                  evaluations {
                    name
                    label
                    score
                  }
                  span {
                    id
                  }
                }
              }
            }
          }
        """
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-nonexistent-model",  # triggers an error
                    }
                },
                "datasetId": dataset_gid,
                "datasetVersionId": version_gid,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            }
        }

        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])
            assert (examples := field["examples"])
            assert len(examples) == 1

            example = examples[0]
            repetition = example["repetition"]
            # Verify the task errored
            assert repetition["errorMessage"]
            assert repetition["content"] is None

            # Verify no evaluations were run
            assert repetition["evaluations"] == []

        # Verify no experiment run annotations were persisted
        async with db() as session:
            result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 0


def _request_bodies_contain_same_city(request1: Request, request2: Request) -> None:
    assert _extract_city(request1.body.decode()) == _extract_city(request2.body.decode())


def _extract_city(body: str) -> str:
    if match := re.search(r"What country is (\w+) in\?", body):
        return match.group(1)
    raise ValueError(f"Could not extract city from body: {body}")
