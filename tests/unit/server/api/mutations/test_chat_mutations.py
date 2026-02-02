import json
import re
from typing import Awaitable, Callable

from openinference.semconv.trace import (
    MessageAttributes,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH
from sqlalchemy import select
from strawberry.relay import GlobalID
from vcr.request import Request

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.evaluators import (
    TEMPLATE_FORMATTED_MESSAGES,
    TEMPLATE_LITERAL_MAPPING,
    TEMPLATE_MESSAGES,
    TEMPLATE_PATH_MAPPING,
    TEMPLATE_VARIABLES,
    _generate_builtin_evaluator_id,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import DatasetEvaluator
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.experiments.utils import is_experiment_project_name
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import flatten

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
            assert repetition["content"]
            assert "Paris" in repetition["content"]
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
                    }
                },
                "credentials": [{"envVarName": "OPENAI_API_KEY", "value": "sk-"}],
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
                dataset_splits_result = await session.execute(
                    select(models.ExperimentDatasetSplit).where(
                        models.ExperimentDatasetSplit.experiment_id == exp_id
                    )
                )
                split_links = dataset_splits_result.scalars().all()
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
                dataset_splits_result = await session.execute(
                    select(models.ExperimentDatasetSplit)
                    .where(models.ExperimentDatasetSplit.experiment_id == exp_id)
                    .order_by(models.ExperimentDatasetSplit.dataset_split_id)
                )
                split_links = dataset_splits_result.scalars().all()
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
                dataset_split_results = await session.execute(
                    select(models.ExperimentDatasetSplit).where(
                        models.ExperimentDatasetSplit.experiment_id == exp_id
                    )
                )
                split_links = dataset_split_results.scalars().all()
                assert len(split_links) == 0  # No splits associated

    async def test_chat_completion_over_dataset_with_template_variables_path(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        custom_vcr: CustomVCR,
    ) -> None:
        """
        Test that template_variables_path is respected in non-streaming mode.

        When templateVariablesPath is set to empty string (root of example),
        the template should have access to the full context:
        - input: the dataset example input
        - reference: the dataset example output (renamed from output)
        - metadata: the dataset example metadata

        This test uses a template that references {reference}, which should only
        be available when the full context is used (templateVariablesPath = "").

        The single_example_dataset fixture has:
        - input: {"city": "Paris"}
        - output: {"country": "France"} (becomes "reference" in template context)
        """
        dataset_id = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
                repetition {
                  content
                  errorMessage
                  span {
                    input {
                      value
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
                "credentials": [{"envVarName": "OPENAI_API_KEY", "value": "sk-"}],
                "datasetId": dataset_id,
                "messages": [
                    {
                        "role": "SYSTEM",
                        "content": (
                            "You are a helpful assistant. The expected answer is: {reference}"
                        ),
                    },
                    {
                        "role": "USER",
                        "content": "Question: {input}",
                    },
                ],
                "templateFormat": "F_STRING",
                # Empty string means use the root of the example context
                # (input, reference, metadata)
                "templateVariablesPath": "",
                "repetitions": 1,
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])
            assert field["datasetId"] == dataset_id
            assert (examples := field["examples"])
            assert len(examples) == 1

            example = examples[0]
            repetition = example["repetition"]
            # The template should have been formatted successfully without errors
            assert repetition["errorMessage"] is None, (
                f"Expected no error, but got: {repetition['errorMessage']}. "
            )
            # Verify content was returned from the LLM
            assert repetition["content"] is not None

            # Verify the span input contains the correct template variables
            # (the full context with input, reference, metadata)
            assert repetition["span"]["input"]["value"]
            span_input = json.loads(repetition["span"]["input"]["value"])

            # Check that template variables contain the full context
            template_vars = span_input.get("template", {}).get("variables", {})
            # input should contain the dataset example's input
            assert template_vars.get("input") == {"city": "Paris"}
            # reference should contain the dataset example's output (renamed from output)
            assert template_vars.get("reference") == {"country": "France"}
            # metadata should be present (empty dict in this fixture)
            assert "metadata" in template_vars

    async def test_chat_completion_over_dataset_with_nonempty_template_variables_path(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        custom_vcr: CustomVCR,
    ) -> None:
        """
        Test that template_variables_path is respected when set to a non-empty value.

        When templateVariablesPath is set to "input", the template should have access
        only to the contents of the input field, not the full context (input, reference, metadata).

        This means the template can reference {city} directly instead of {input.city}.

        The single_example_dataset fixture has:
        - input: {"city": "Paris"}
        - output: {"country": "France"} (becomes "reference" in full context)
        """
        dataset_id = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        query = """
          mutation ChatCompletionOverDataset($input: ChatCompletionOverDatasetInput!) {
            chatCompletionOverDataset(input: $input) {
              datasetId
              experimentId
              examples {
                datasetExampleId
                experimentRunId
                repetition {
                  content
                  errorMessage
                  span {
                    input {
                      value
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
                "credentials": [{"envVarName": "OPENAI_API_KEY", "value": "sk-"}],
                "datasetId": dataset_id,
                "messages": [
                    {
                        "role": "USER",
                        # Using {city} directly, which is only accessible when
                        # templateVariablesPath extracts the input contents
                        "content": "What country is {city} in? Answer in one word.",
                    },
                ],
                "templateFormat": "F_STRING",
                # "input" means use the contents of the input field as template variables
                # This makes {city} available directly instead of requiring {input.city}
                "templateVariablesPath": "input",
                "repetitions": 1,
            }
        }
        with custom_vcr.use_cassette():
            result = await gql_client.execute(query, variables, "ChatCompletionOverDataset")
            assert not result.errors
            assert (data := result.data)
            assert (field := data["chatCompletionOverDataset"])
            assert field["datasetId"] == dataset_id
            assert (examples := field["examples"])
            assert len(examples) == 1

            example = examples[0]
            repetition = example["repetition"]
            # The template should have been formatted successfully without errors
            assert repetition["errorMessage"] is None, (
                f"Expected no error, but got: {repetition['errorMessage']}"
            )
            # Verify content was returned from the LLM
            assert repetition["content"] is not None

            # Verify the span input contains the correct template variables
            # (only the input contents, not the full context)
            assert repetition["span"]["input"]["value"]
            span_input = json.loads(repetition["span"]["input"]["value"])

            # Check that template variables contain only the input contents
            # (not the full context with input/reference/metadata)
            template_vars = span_input.get("template", {}).get("variables", {})
            # Should have the city key directly, not nested under "input"
            assert template_vars.get("city") == "Paris"
            # Should NOT have the full context keys
            assert "input" not in template_vars
            assert "reference" not in template_vars
            assert "metadata" not in template_vars

    async def test_evaluator_returns_evaluation_and_persists_span_annotation(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        # Create dataset and DatasetEvaluators
        contains_id = _generate_builtin_evaluator_id("Contains")
        async with db() as session:
            dataset = models.Dataset(name="test-eval-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            llm_dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=correctness_llm_evaluator.id,
                name=Identifier("correctness"),
                input_mapping={},
                project=models.Project(name="correctness-project", description=""),
            )
            builtin_dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                builtin_evaluator_id=contains_id,
                name=Identifier("contains-four"),
                input_mapping={},
                project=models.Project(name="contains-project", description=""),
            )
            session.add_all([llm_dataset_evaluator, builtin_dataset_evaluator])
            await session.flush()

            llm_evaluator_gid = str(
                GlobalID(type_name=DatasetEvaluator.__name__, node_id=str(llm_dataset_evaluator.id))
            )
            builtin_evaluator_gid = str(
                GlobalID(
                    type_name=DatasetEvaluator.__name__, node_id=str(builtin_dataset_evaluator.id)
                )
            )
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                evaluations {
                  ... on EvaluationSuccess {
                    annotation {
                      name
                      label
                      score
                      explanation
                      annotatorKind
                    }
                  }
                  ... on EvaluationError {
                    evaluatorName
                    message
                  }
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
                        "id": llm_evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    },
                    {
                        "id": builtin_evaluator_gid,
                        "name": "contains-four",
                        "inputMapping": {
                            "literalMapping": {"words": "4"},
                            "pathMapping": {"text": "$.output"},
                        },
                    },
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
        assert len(evaluations) == 2
        llm_eval = next(
            eval_ for eval_ in evaluations if eval_["annotation"]["name"] == "correctness"
        )
        assert llm_eval["annotation"]["annotatorKind"] == "LLM"
        assert llm_eval["annotation"]["label"] == "correct"
        builtin_eval = next(
            eval_ for eval_ in evaluations if eval_["annotation"]["name"] == "contains-four"
        )
        assert builtin_eval["annotation"]["annotatorKind"] == "CODE"
        assert builtin_eval["annotation"]["label"] == "true"

        # Verify span annotations were persisted in DB
        async with db() as session:
            span_annotations_result = await session.execute(select(models.SpanAnnotation))
            annotations = span_annotations_result.scalars().all()

        assert len(annotations) == 2

        llm_annotation = next(
            annotation for annotation in annotations if annotation.name == "correctness"
        )
        assert llm_annotation.annotator_kind == "LLM"
        assert llm_annotation.label == "correct"

        builtin_annotation = next(
            annotation for annotation in annotations if annotation.name == "contains-four"
        )
        assert builtin_annotation.annotator_kind == "CODE"
        assert builtin_annotation.label == "true"

    async def test_evaluator_not_run_when_task_errors(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that evaluators are not run when the chat completion errors out."""
        # Create dataset and DatasetEvaluator
        async with db() as session:
            dataset = models.Dataset(name="test-error-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=correctness_llm_evaluator.id,
                name=Identifier("correctness"),
                input_mapping={},
                project=models.Project(name="correctness-error-project", description=""),
            )
            session.add(dataset_evaluator)
            await session.flush()

            evaluator_gid = str(
                GlobalID(type_name=DatasetEvaluator.__name__, node_id=str(dataset_evaluator.id))
            )
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                evaluations {
                  ... on EvaluationSuccess {
                    annotation {
                      name
                      label
                      score
                    }
                  }
                  ... on EvaluationError {
                    evaluatorName
                    message
                  }
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
                        "name": "correctness",
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
            span_annotations_result = await session.execute(select(models.SpanAnnotation))
            annotations = span_annotations_result.scalars().all()
            assert len(annotations) == 0  # verify no span annotations were persisted

    async def test_evaluator_over_dataset_returns_evaluations_and_persists_annotations(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_correctness_llm_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        assign_exact_match_builtin_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that chat_completion_over_dataset mutation with evaluator returns evaluations
        and persists experiment run annotations."""
        llm_dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        llm_evaluator_gid = str(
            GlobalID(type_name=DatasetEvaluator.__name__, node_id=str(llm_dataset_evaluator.id))
        )
        builtin_dataset_evaluator = await assign_exact_match_builtin_evaluator_to_dataset(
            single_example_dataset.id
        )
        builtin_evaluator_gid = str(
            GlobalID(
                type_name=DatasetEvaluator.__name__,
                node_id=str(builtin_dataset_evaluator.id),
            )
        )

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
                    ... on EvaluationSuccess {
                      annotation {
                        name
                        label
                        score
                        annotatorKind
                      }
                    }
                    ... on EvaluationError {
                      evaluatorName
                      message
                    }
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
                "tracingEnabled": True,
                "evaluators": [
                    {
                        "id": llm_evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    },
                    {
                        "id": builtin_evaluator_gid,
                        "name": "exact-match",
                        "inputMapping": {
                            "literalMapping": {"expected": "France"},
                            "pathMapping": {"actual": "$.output.messages[0].content"},
                        },
                    },
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
            assert len(evaluations) == 2
            llm_eval = next(
                eval_ for eval_ in evaluations if eval_["annotation"]["name"] == "correctness"
            )
            assert llm_eval["annotation"]["annotatorKind"] == "LLM"
            assert (
                llm_eval["annotation"]["label"] == "incorrect"
            )  # this is due a deficiency in our context object (https://github.com/Arize-ai/phoenix/issues/11068)
            builtin_eval = next(
                eval_ for eval_ in evaluations if eval_["annotation"]["name"] == "exact-match"
            )
            assert builtin_eval["annotation"]["annotatorKind"] == "CODE"
            assert builtin_eval["annotation"]["label"] == "true"

        # Verify experiment run annotations were persisted in DB
        async with db() as session:
            run_annotations_result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = run_annotations_result.scalars().all()
            assert len(annotations) == 2

            llm_annotation_orm = next(
                annotation for annotation in annotations if annotation.name == "correctness"
            )
            assert llm_annotation_orm.annotator_kind == "LLM"
            assert llm_annotation_orm.experiment_run_id is not None
            assert (
                llm_annotation_orm.label == "incorrect"
            )  # this is due a deficiency in our context object (https://github.com/Arize-ai/phoenix/issues/11068)

            builtin_annotation_orm = next(
                annotation for annotation in annotations if annotation.name == "exact-match"
            )
            assert builtin_annotation_orm.annotator_kind == "CODE"
            assert builtin_annotation_orm.experiment_run_id is not None
            assert builtin_annotation_orm.label == "true"

            evaluator_traces_result = await session.scalars(
                select(models.Trace).where(
                    models.Trace.project_rowid == llm_dataset_evaluator.project_id,
                )
            )
            evaluator_traces = evaluator_traces_result.all()
            assert len(evaluator_traces) == 1
            llm_evaluator_trace = evaluator_traces[0]

            evaluator_spans_result = await session.execute(
                select(models.Span).where(
                    models.Span.trace_rowid == llm_evaluator_trace.id,
                )
            )
            llm_spans = evaluator_spans_result.scalars().all()
            assert len(llm_spans) == 4

            # Parse LLM evaluator spans
            llm_evaluator_span = None
            llm_template_span = None
            llm_llm_span = None
            llm_parse_span = None
            for span in llm_spans:
                if span.span_kind == "EVALUATOR":
                    llm_evaluator_span = span
                elif span.span_kind == "TEMPLATE":
                    llm_template_span = span
                elif span.span_kind == "LLM":
                    llm_llm_span = span
                elif span.span_kind == "CHAIN":
                    llm_parse_span = span

            assert llm_evaluator_span is not None
            assert llm_evaluator_span.parent_id is None
            assert llm_template_span is not None
            assert llm_template_span.parent_id == llm_evaluator_span.span_id
            assert llm_llm_span is not None
            assert llm_llm_span.parent_id == llm_evaluator_span.span_id
            assert llm_parse_span is not None
            assert llm_parse_span.parent_id == llm_evaluator_span.span_id

            # LLM evaluator span
            assert llm_evaluator_span.name == "Evaluation: correctness-evaluator"
            assert llm_evaluator_span.span_kind == "EVALUATOR"
            attributes = dict(flatten(llm_evaluator_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
            raw_input_value = attributes.pop(INPUT_VALUE)
            assert raw_input_value is not None
            input_value = json.loads(raw_input_value)
            assert set(input_value.keys()) == {"input", "output", "reference"}
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            raw_output_value = attributes.pop(OUTPUT_VALUE)
            assert raw_output_value is not None
            output_value = json.loads(raw_output_value)
            assert set(output_value.keys()) == {"score", "label", "explanation"}
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes
            assert not llm_evaluator_span.events
            assert llm_evaluator_span.status_code == "OK"
            assert not llm_evaluator_span.status_message

            # template span
            assert llm_template_span.name == "Apply template variables"
            assert llm_template_span.span_kind == "TEMPLATE"
            assert llm_template_span.status_code == "OK"
            assert not llm_template_span.status_message
            assert not llm_template_span.events
            attributes = dict(flatten(llm_template_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "TEMPLATE"
            assert attributes.pop(f"{TEMPLATE_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                attributes.pop(f"{TEMPLATE_MESSAGES}.0.{MESSAGE_CONTENT}")
                == "You are an evaluator that assesses the correctness of outputs."
            )
            assert attributes.pop(f"{TEMPLATE_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert (
                attributes.pop(f"{TEMPLATE_MESSAGES}.1.{MESSAGE_CONTENT}")
                == "Input: {{input}}\n\nOutput: {{output}}\n\nIs this output correct?"
            )
            assert json.loads(attributes.pop(TEMPLATE_PATH_MAPPING)) == {
                "input": "$.input",
                "output": "$.output",
            }
            assert json.loads(attributes.pop(TEMPLATE_LITERAL_MAPPING)) == {}
            assert json.loads(attributes.pop(TEMPLATE_VARIABLES)) == {
                "input": {"city": "Paris"},
                "output": {
                    "available_tools": [],
                    "messages": [{"content": "France", "role": "assistant"}],
                },
                "reference": {"country": "France"},
            }
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.0.{MESSAGE_CONTENT}")
                == "You are an evaluator that assesses the correctness of outputs."
            )
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.1.{MESSAGE_CONTENT}") == (
                "Input: {'city': 'Paris'}\n\n"
                "Output: {'messages': [{'role': 'assistant', 'content': 'France'}], 'available_tools': []}\n\n"
                "Is this output correct?"
            )
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "variables": {
                    "input": {"city": "Paris"},
                    "output": {
                        "available_tools": [],
                        "messages": [{"content": "France", "role": "assistant"}],
                    },
                    "reference": {"country": "France"},
                },
                "input_mapping": {
                    "path_mapping": {"input": "$.input", "output": "$.output"},
                    "literal_mapping": {},
                },
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an evaluator that assesses the correctness of outputs.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Input: {'city': 'Paris'}\n\n"
                            "Output: {'messages': [{'role': 'assistant', 'content': 'France'}], "
                            "'available_tools': []}\n\n"
                            "Is this output correct?"
                        ),
                    },
                ]
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # llm span
            assert llm_llm_span.name == "gpt-4"
            assert llm_llm_span.span_kind == "LLM"
            assert llm_llm_span.status_code == "OK"
            assert not llm_llm_span.status_message
            assert llm_llm_span.llm_token_count_prompt is not None
            assert llm_llm_span.llm_token_count_prompt > 0
            assert llm_llm_span.llm_token_count_completion is not None
            assert llm_llm_span.llm_token_count_completion > 0
            assert llm_llm_span.cumulative_llm_token_count_prompt > 0
            assert llm_llm_span.cumulative_llm_token_count_completion > 0
            attributes = dict(flatten(llm_llm_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "LLM"
            assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
            assert attributes.pop(LLM_PROVIDER) == "openai"
            assert attributes.pop(LLM_SYSTEM) == "openai"
            assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                "evaluator" in attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}").lower()
            )
            assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert "Paris" in attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
            token_count_attribute_keys = [
                attribute_key
                for attribute_key in attributes
                if attribute_key.startswith("llm.token_count.")
            ]
            for key in token_count_attribute_keys:
                assert isinstance(attributes.pop(key), int)
            assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
            assert attributes.pop(URL_PATH) == "chat/completions"
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            raw_output_value = attributes.pop(OUTPUT_VALUE)
            output_value = json.loads(raw_output_value)
            messages = output_value.pop("messages")
            assert not output_value
            assert messages is not None
            assert len(messages) == 1
            message = messages[0]
            assert message.pop("role") == "assistant"
            tool_calls = message.pop("tool_calls")
            assert not message
            assert len(tool_calls) == 1
            tool_call = tool_calls[0]
            assert isinstance(tool_call.pop("id"), str)
            function = tool_call.pop("function")
            assert isinstance(function, dict)
            assert function.pop("name") == "evaluate_correctness"
            raw_arguments = function.pop("arguments")
            assert isinstance(raw_arguments, str)
            arguments = json.loads(raw_arguments)
            assert arguments.pop("label") == "incorrect"
            assert not arguments
            assert not function
            assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
            assert isinstance(
                attributes.pop(
                    f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}"
                ),
                str,
            )
            assert (
                attributes.pop(
                    f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}"
                )
                == "evaluate_correctness"
            )
            arguments = attributes.pop(
                f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS}"
            )
            assert arguments is not None
            assert json.loads(arguments) == {"label": "incorrect"}
            assert not attributes

            # span costs for evaluator trace
            span_costs_result = await session.execute(
                select(models.SpanCost).where(models.SpanCost.trace_rowid == llm_evaluator_trace.id)
            )
            span_costs = span_costs_result.scalars().all()
            assert len(span_costs) == 1
            span_cost = span_costs[0]
            assert span_cost.span_rowid == llm_llm_span.id
            assert span_cost.trace_rowid == llm_llm_span.trace_rowid
            assert span_cost.model_id is not None
            assert span_cost.span_start_time == llm_llm_span.start_time
            assert span_cost.total_cost is not None
            assert span_cost.total_cost > 0
            assert span_cost.total_tokens == (
                llm_llm_span.llm_token_count_prompt + llm_llm_span.llm_token_count_completion
            )
            assert span_cost.prompt_tokens == llm_llm_span.llm_token_count_prompt
            assert span_cost.prompt_cost is not None
            assert span_cost.prompt_cost > 0
            assert span_cost.completion_tokens == llm_llm_span.llm_token_count_completion
            assert span_cost.completion_cost is not None
            assert span_cost.completion_cost > 0

            # span cost details for evaluator trace
            span_cost_details_result = await session.execute(
                select(models.SpanCostDetail).where(
                    models.SpanCostDetail.span_cost_id == span_cost.id
                )
            )
            span_cost_details = span_cost_details_result.scalars().all()
            assert len(span_cost_details) >= 2
            input_detail = next(
                d for d in span_cost_details if d.is_prompt and d.token_type == "input"
            )
            output_detail = next(
                d for d in span_cost_details if not d.is_prompt and d.token_type == "output"
            )
            assert input_detail.span_cost_id == span_cost.id
            assert input_detail.token_type == "input"
            assert input_detail.is_prompt is True
            assert input_detail.tokens == llm_llm_span.llm_token_count_prompt
            assert input_detail.cost is not None
            assert input_detail.cost > 0
            assert input_detail.cost_per_token is not None
            assert output_detail.span_cost_id == span_cost.id
            assert output_detail.token_type == "output"
            assert output_detail.is_prompt is False
            assert output_detail.tokens == llm_llm_span.llm_token_count_completion
            assert output_detail.cost is not None
            assert output_detail.cost > 0
            assert output_detail.cost_per_token is not None

            # chain span
            assert llm_parse_span.name == "Parse eval result"
            assert llm_parse_span.span_kind == "CHAIN"
            assert llm_parse_span.status_code == "OK"
            assert not llm_parse_span.status_message
            assert not llm_parse_span.events
            attributes = dict(flatten(llm_parse_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            input_value = json.loads(attributes.pop(INPUT_VALUE))
            assert set(input_value.keys()) == {"tool_calls", "output_config"}
            tool_calls = input_value["tool_calls"]
            assert len(tool_calls) == 1
            tool_call = next(iter(tool_calls.values()))
            assert tool_call["name"] == "evaluate_correctness"
            assert input_value["output_config"] == {
                "values": [
                    {"label": "correct", "score": 1.0},
                    {"label": "incorrect", "score": 0.0},
                ]
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "label": "incorrect",
                "score": 0.0,
                "explanation": None,
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in evaluator traces
            builtin_traces_result = await session.scalars(
                select(models.Trace).where(
                    models.Trace.project_rowid == builtin_dataset_evaluator.project_id,
                )
            )
            builtin_traces = builtin_traces_result.all()
            assert len(builtin_traces) == 1
            builtin_evaluator_trace = builtin_traces[0]

            builtin_spans_result = await session.execute(
                select(models.Span).where(
                    models.Span.trace_rowid == builtin_evaluator_trace.id,
                )
            )
            builtin_spans = builtin_spans_result.scalars().all()
            assert len(builtin_spans) == 4

            # Parse built-in evaluator spans
            builtin_evaluator_span = None
            builtin_template_span = None
            builtin_execution_span = None
            builtin_parse_span = None
            for span in builtin_spans:
                if span.span_kind == "EVALUATOR":
                    builtin_evaluator_span = span
                elif span.span_kind == "TEMPLATE":
                    builtin_template_span = span
                elif span.span_kind == "CHAIN":
                    if "Run" in span.name:
                        builtin_execution_span = span
                    elif "Parse" in span.name:
                        builtin_parse_span = span

            assert builtin_evaluator_span is not None
            assert builtin_template_span is not None
            assert builtin_execution_span is not None
            assert builtin_parse_span is not None

            # Verify span hierarchy
            assert builtin_evaluator_span.parent_id is None
            assert builtin_template_span.parent_id == builtin_evaluator_span.span_id
            assert builtin_execution_span.parent_id == builtin_evaluator_span.span_id
            assert builtin_parse_span.parent_id == builtin_evaluator_span.span_id

            # Built-in evaluator span
            assert builtin_evaluator_span.name == "Evaluation: ExactMatch"
            assert builtin_evaluator_span.span_kind == "EVALUATOR"
            assert builtin_evaluator_span.status_code == "OK"
            assert not builtin_evaluator_span.status_message
            assert not builtin_evaluator_span.events
            attributes = dict(flatten(builtin_evaluator_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "input": {"city": "Paris"},
                "output": {
                    "messages": [{"role": "assistant", "content": "France"}],
                    "available_tools": [],
                },
                "reference": {"country": "France"},
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "label": "true",
                "score": 1.0,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in template span (Apply input mapping)
            assert builtin_template_span.name == "Apply input mapping"
            assert builtin_template_span.span_kind == "TEMPLATE"
            assert builtin_template_span.status_code == "OK"
            assert not builtin_template_span.status_message
            assert not builtin_template_span.events
            attributes = dict(flatten(builtin_template_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "TEMPLATE"
            assert json.loads(attributes.pop(TEMPLATE_PATH_MAPPING)) == {
                "actual": "$.output.messages[0].content",
            }
            assert json.loads(attributes.pop(TEMPLATE_LITERAL_MAPPING)) == {"expected": "France"}
            assert json.loads(attributes.pop(TEMPLATE_VARIABLES)) == {
                "input": {"city": "Paris"},
                "output": {
                    "messages": [{"role": "assistant", "content": "France"}],
                    "available_tools": [],
                },
                "reference": {"country": "France"},
            }
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "variables": {
                    "input": {"city": "Paris"},
                    "output": {
                        "messages": [{"role": "assistant", "content": "France"}],
                        "available_tools": [],
                    },
                    "reference": {"country": "France"},
                },
                "input_mapping": {
                    "path_mapping": {"actual": "$.output.messages[0].content"},
                    "literal_mapping": {"expected": "France"},
                },
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "inputs": {"expected": "France", "actual": "France"},
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in execution span (Run ExactMatch)
            assert builtin_execution_span.name == "Run ExactMatch"
            assert builtin_execution_span.span_kind == "CHAIN"
            assert builtin_execution_span.status_code == "OK"
            assert not builtin_execution_span.status_message
            assert not builtin_execution_span.events
            attributes = dict(flatten(builtin_execution_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "expected": "France",
                "actual": "France",
                "case_sensitive": True,
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "matched": True,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in parse span (Parse eval result)
            assert builtin_parse_span.name == "Parse eval result"
            assert builtin_parse_span.span_kind == "CHAIN"
            assert not builtin_parse_span.status_message
            assert not builtin_parse_span.events
            attributes = dict(flatten(builtin_parse_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "matched": True,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {"label": "true", "score": 1.0}
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

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
        dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(type_name=DatasetEvaluator.__name__, node_id=str(dataset_evaluator.id))
        )

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
                    ... on EvaluationSuccess {
                      annotation {
                        name
                        label
                        score
                      }
                    }
                    ... on EvaluationError {
                      evaluatorName
                      message
                    }
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
                        "name": "correctness",
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
            assert repetition["errorMessage"]  # verify the task errored
            assert repetition["content"] is None

            assert repetition["evaluations"] == []  # verify no evaluations were run

        async with db() as session:
            run_annotations_result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = run_annotations_result.scalars().all()
            assert len(annotations) == 0  # verify no experiment run annotations were persisted

    async def test_builtin_evaluator_uses_name_for_annotation(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that builtin evaluators use the name for annotation names."""
        exact_match_id = _generate_builtin_evaluator_id("ExactMatch")
        custom_name = "my-custom-exact-match"

        # Create dataset and DatasetEvaluator
        async with db() as session:
            dataset = models.Dataset(name="test-builtin-name-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                builtin_evaluator_id=exact_match_id,
                name=Identifier(custom_name),
                input_mapping={},
                project=models.Project(name="builtin-name-project", description=""),
            )
            session.add(dataset_evaluator)
            await session.flush()

            evaluator_gid = str(
                GlobalID(type_name=DatasetEvaluator.__name__, node_id=str(dataset_evaluator.id))
            )
        query = """
          mutation ChatCompletion($input: ChatCompletionInput!) {
            chatCompletion(input: $input) {
              repetitions {
                repetitionNumber
                content
                errorMessage
                evaluations {
                  ... on EvaluationSuccess {
                    annotation {
                      name
                      score
                      annotatorKind
                    }
                  }
                  ... on EvaluationError {
                    evaluatorName
                    message
                  }
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
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4o-mini"}},
                "messages": [
                    {
                        "role": "USER",
                        "content": "Say hello",
                    }
                ],
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.0},
                ],
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "name": custom_name,
                        "inputMapping": {
                            "literalMapping": {
                                "expected": "hello",
                                "actual": "hello",
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
            assert not repetition["errorMessage"]

            # Verify evaluations use name, not builtin evaluator name
            assert (evaluations := repetition["evaluations"])
            assert len(evaluations) == 1
            eval_result = evaluations[0]["annotation"]
            assert eval_result["name"] == custom_name
            assert eval_result["annotatorKind"] == "CODE"
            assert eval_result["score"] == 1.0

        # Verify span annotation was persisted with name
        async with db() as session:
            span_annotations_result = await session.execute(select(models.SpanAnnotation))
            annotations = span_annotations_result.scalars().all()
            assert len(annotations) == 1

            annotation = annotations[0]
            assert annotation.name == custom_name
            assert annotation.annotator_kind == "CODE"

    async def test_builtin_evaluator_over_dataset_uses_name_for_annotation(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_exact_match_builtin_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that builtin evaluators use the name for annotations in dataset runs."""
        builtin_dataset_evaluator = await assign_exact_match_builtin_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(
                type_name=DatasetEvaluator.__name__,
                node_id=str(builtin_dataset_evaluator.id),
            )
        )
        custom_name = "my-dataset-exact-match"

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
                    ... on EvaluationSuccess {
                      annotation {
                        name
                        score
                        annotatorKind
                      }
                    }
                    ... on EvaluationError {
                      evaluatorName
                      message
                    }
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
                        "name": custom_name,
                        "inputMapping": {
                            "literalMapping": {
                                "expected": "test",
                                "actual": "test",
                            },
                        },
                    }
                ],
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
            assert (examples := field["examples"])
            assert len(examples) == 1

            example = examples[0]
            repetition = example["repetition"]
            assert not repetition["errorMessage"]

            # Verify evaluations use name, not builtin evaluator name
            assert (evaluations := repetition["evaluations"])
            assert len(evaluations) == 1
            eval_result = evaluations[0]["annotation"]
            assert eval_result["name"] == custom_name
            assert eval_result["annotatorKind"] == "CODE"
            assert eval_result["score"] == 1.0

        # Verify experiment run annotation was persisted with name
        async with db() as session:
            run_annotations_result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = run_annotations_result.scalars().all()
            assert len(annotations) == 1

            annotation = annotations[0]
            assert annotation.name == custom_name
            assert annotation.annotator_kind == "CODE"


def _request_bodies_contain_same_city(request1: Request, request2: Request) -> None:
    assert _extract_city(request1.body.decode()) == _extract_city(request2.body.decode())


def _extract_city(body: str) -> str:
    if match := re.search(r"What country is (\w+) in\?", body):
        return match.group(1)
    raise ValueError(f"Could not extract city from body: {body}")


# message attributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE

# span attributes
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE

# tool call attributes
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
