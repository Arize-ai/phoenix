from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestDatasetLLMEvaluatorMutations:
    _MUTATION = """
      mutation($input: CreateDatasetLLMEvaluatorInput!) {
        createDatasetLlmEvaluator(input: $input) {
          evaluator {
            id
            displayName
            evaluator {
              ... on LLMEvaluator {
                id
                name
                description
                kind
                prompt { id }
                promptVersion { id }
              }
            }
          }
          query { __typename }
        }
      }
    """

    _PROMPT_VERSION_QUERY = """
      query($id: ID!) {
        node(id: $id) {
          ... on PromptVersion {
            template {
              ... on PromptChatTemplate {
                messages { role content { ... on TextContentPart { text { text } } } }
              }
            }
          }
        }
      }
    """

    async def _create(self, gql_client: AsyncGraphQLClient, **input_fields: Any) -> Any:
        """Private helper to execute create mutation with given input fields."""
        return await gql_client.execute(self._MUTATION, {"input": input_fields})

    async def _verify_prompt_version_messages(
        self, gql_client: AsyncGraphQLClient, prompt_version_id: str, expected_text: str
    ) -> None:
        """Private helper to fetch and verify promptVersion message content."""
        result = await gql_client.execute(self._PROMPT_VERSION_QUERY, {"id": prompt_version_id})
        assert result.data and not result.errors
        messages = result.data["node"]["template"]["messages"]
        actual_text = messages[0]["content"][0]["text"]["text"]
        assert actual_text == expected_text

    async def test_create_dataset_llm_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Success: OpenAI evaluator
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="test-evaluator",
            description="test description",
            promptVersion=dict(
                description="prompt version",
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[dict(role="USER", content=[dict(text=dict(text="Eval {{input}}"))])]
                ),
                invocationParameters=dict(
                    temperature=0.0,
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test-evaluator"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test-evaluator",
                                description="test description",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        correctness=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                        )
                                    ),
                                    required=["correctness"],
                                ),
                            ),
                        )
                    )
                ],
                modelProvider="OPENAI",
                modelName="gpt-4",
            ),
            outputConfig=dict(
                name="correctness",
                description="description",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
        llm_evaluator_data = dataset_evaluator["evaluator"]
        assert dataset_evaluator["displayName"] == "test-evaluator"
        assert llm_evaluator_data["kind"] == "LLM"
        await self._verify_prompt_version_messages(
            gql_client, llm_evaluator_data["promptVersion"]["id"], "Eval {{input}}"
        )

        dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.evaluator_id is not None
            llm_evaluator = await session.get(
                models.LLMEvaluator, db_dataset_evaluator.evaluator_id
            )
            assert llm_evaluator and llm_evaluator.kind == "LLM"
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {},
                "path_mapping": {},
            }

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="anthropic",
            description="anthropic",
            promptVersion=dict(
                description="anthropic version",
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content=[dict(text=dict(text="Rate"))])]),
                invocationParameters=dict(
                    temperature=0.7,
                    max_tokens=50,
                    tool_choice=dict(
                        type="tool",
                        name="anthropic",
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            name="anthropic",
                            description="anthropic",
                            input_schema=dict(
                                type="object",
                                properties=dict(
                                    correctness=dict(
                                        type="string",
                                        enum=["correct", "incorrect"],
                                    )
                                ),
                                required=["correctness"],
                            ),
                        )
                    )
                ],
                modelProvider="ANTHROPIC",
                modelName="claude-3-opus-20240229",
            ),
            outputConfig=dict(
                name="correctness",
                description="description",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
        llm_evaluator_data = dataset_evaluator["evaluator"]
        await self._verify_prompt_version_messages(
            gql_client, llm_evaluator_data["promptVersion"]["id"], "Rate"
        )

        # Success: Multiple evaluators for same dataset
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="second",
            description="second",
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[dict(role="USER", content=[dict(text=dict(text="Second"))])]
                ),
                invocationParameters=dict(
                    temperature=0.5,
                    max_tokens=100,
                    tool_choice=dict(
                        type="tool",
                        name="second",
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            name="second",
                            description="second",
                            input_schema=dict(
                                type="object",
                                properties=dict(
                                    correctness=dict(
                                        type="string",
                                        enum=["correct", "incorrect"],
                                    )
                                ),
                                required=["correctness"],
                            ),
                        )
                    )
                ],
                modelProvider="ANTHROPIC",
                modelName="claude-3-opus-20240229",
            ),
            outputConfig=dict(
                name="correctness",
                description="description",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
        llm_evaluator_data = dataset_evaluator["evaluator"]
        await self._verify_prompt_version_messages(
            gql_client, llm_evaluator_data["promptVersion"]["id"], "Second"
        )
        async with db() as session:
            evaluators = await session.scalars(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id
                )
            )
            assert len(evaluators.all()) >= 2

        # Failure: Nonexistent dataset
        result = await self._create(
            gql_client,
            datasetId=str(GlobalID("Dataset", "999")),
            name="test",
            description="test",
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content=[dict(text=dict(text="Test"))])]),
                invocationParameters=dict(
                    temperature=0.5,
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test",
                                description="test",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        correctness=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                        )
                                    ),
                                    required=["correctness"],
                                ),
                            ),
                        )
                    )
                ],
                modelProvider="OPENAI",
                modelName="gpt-4",
            ),
            outputConfig=dict(
                name="correctness",
                description="description",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )
        assert result.errors and "Dataset with id 999 not found" in result.errors[0].message

        # Failure: Invalid template format
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="invalid",
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content="invalid")]),
                invocationParameters=dict(temperature=0.5),
                modelProvider="OPENAI",
                modelName="gpt-4",
            ),
            outputConfig=dict(
                name="correctness",
                description="description",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )
        assert result.errors


class TestUpdateDatasetLLMEvaluatorMutation:
    _UPDATE_MUTATION = """
      mutation($input: UpdateDatasetLLMEvaluatorInput!) {
        updateDatasetLlmEvaluator(input: $input) {
          evaluator {
            id
            displayName
            evaluator {
              ... on LLMEvaluator {
                id
                name
                description
                kind
                promptVersion { id }
              }
            }
          }
          query { __typename }
        }
      }
    """

    async def test_update_dataset_llm_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test updating an LLM evaluator via its DatasetEvaluator assignment."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Get the dataset_evaluator ID from the fixture
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))

        # Update the evaluator with new values
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": "updated-evaluator-name",
                    "description": "updated description",
                    "promptVersion": dict(
                        description="updated prompt version",
                        templateFormat="MUSTACHE",
                        template=dict(
                            messages=[
                                dict(role="USER", content=[dict(text=dict(text="Updated: {{input}}"))])
                            ]
                        ),
                        invocationParameters=dict(
                            temperature=0.5,
                            tool_choice=dict(type="function", function=dict(name="updated-tool")),
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="updated-tool",
                                        description="updated description",
                                        parameters=dict(
                                            type="object",
                                            properties=dict(
                                                result=dict(type="string", enum=["good", "bad"])
                                            ),
                                            required=["result"],
                                        ),
                                    ),
                                )
                            )
                        ],
                        modelProvider="OPENAI",
                        modelName="gpt-4",
                    ),
                    "outputConfig": dict(
                        name="result",
                        description="updated output description",
                        optimizationDirection="MINIMIZE",
                        values=[
                            dict(label="good", score=1),
                            dict(label="bad", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        updated_evaluator = result.data["updateDatasetLlmEvaluator"]["evaluator"]
        assert updated_evaluator["displayName"] == "updated-evaluator-name"
        llm_data = updated_evaluator["evaluator"]
        assert llm_data["description"] == "updated description"
        assert llm_data["kind"] == "LLM"

        async with db() as session:
            db_evaluator = await session.get(models.LLMEvaluator, llm_evaluator.id)
            assert db_evaluator is not None
            assert db_evaluator.description == "updated description"
            assert db_evaluator.annotation_name == "result"


class TestAssignUnassignEvaluatorMutations:
    _ASSIGN_MUTATION = """
      mutation($input: AssignEvaluatorToDatasetInput!) {
        assignEvaluatorToDataset(input: $input) {
          evaluator {
            id
            displayName
            evaluator {
              ... on LLMEvaluator { kind prompt { id } }
              ... on CodeEvaluator { kind }
              ... on BuiltInEvaluator { kind }
            }
          }
          query { __typename }
        }
      }
    """

    _UNASSIGN_MUTATION = """
      mutation($input: UnassignEvaluatorFromDatasetInput!) {
        unassignEvaluatorFromDataset(input: $input) {
          evaluator {
            id
            displayName
          }
          query { __typename }
        }
      }
    """

    async def _is_assigned(
        self,
        db: DbSessionFactory,
        dataset_id: int,
        evaluator_id: int,
        display_name: str,
    ) -> bool:
        """Helper to check if an evaluator is assigned to a dataset via database."""
        async with db() as session:
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetEvaluators)
                .where(
                    models.DatasetEvaluators.dataset_id == dataset_id,
                    models.DatasetEvaluators.evaluator_id == evaluator_id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(display_name),
                )
            )
            return bool(count and count > 0)

    async def test_assign_and_unassign_evaluators(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        code_evaluator: models.CodeEvaluator,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Comprehensive test for assigning/unassigning CodeEvaluator and LLMEvaluator."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        code_eval_id = str(GlobalID("CodeEvaluator", str(code_evaluator.id)))
        llm_eval_id = str(GlobalID("LLMEvaluator", str(llm_evaluator.id)))
        code_eval_name = code_evaluator.name.root
        llm_eval_name = llm_evaluator.name.root

        # Test 1: Verify evaluators are already assigned (via ORM relationship in fixtures)
        assert await self._is_assigned(db, empty_dataset.id, code_evaluator.id, code_eval_name)
        assert await self._is_assigned(db, empty_dataset.id, llm_evaluator.id, llm_eval_name)

        # Test 2: Idempotency - assign code evaluator again (already assigned)
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": code_eval_id}},
        )
        assert result.data and not result.errors
        dataset_evaluator_data = result.data["assignEvaluatorToDataset"]["evaluator"]
        assert dataset_evaluator_data["evaluator"]["kind"] == "CODE"
        assert dataset_evaluator_data["displayName"] == code_eval_name

        # Verify only one assignment exists (idempotency)
        async with db() as session:
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetEvaluators)
                .where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == code_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(code_eval_name),
                )
            )
            assert count == 1

        # Test 3: Idempotency for LLM evaluator (already assigned)
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": llm_eval_id}},
        )
        assert result.data and not result.errors
        dataset_evaluator_data = result.data["assignEvaluatorToDataset"]["evaluator"]
        assert dataset_evaluator_data["evaluator"]["kind"] == "LLM"
        assert "prompt" in dataset_evaluator_data["evaluator"]

        # Test 4: Unassign code evaluator - first get the dataset_evaluator_id
        async with db() as session:
            code_dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == code_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(code_eval_name),
                )
            )
            assert code_dataset_evaluator is not None
            code_dataset_evaluator_gid = str(
                GlobalID("DatasetEvaluator", str(code_dataset_evaluator.id))
            )

        result = await gql_client.execute(
            self._UNASSIGN_MUTATION,
            {
                "input": {
                    "datasetId": dataset_id,
                    "datasetEvaluatorId": code_dataset_evaluator_gid,
                }
            },
        )
        assert result.data and not result.errors
        assert (
            result.data["unassignEvaluatorFromDataset"]["evaluator"]["displayName"]
            == code_eval_name
        )

        # Verify code evaluator unassigned
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == code_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(code_eval_name),
                )
            )
            assert dataset_evaluator is None

        assert not await self._is_assigned(db, empty_dataset.id, code_evaluator.id, code_eval_name)

        # Test 5: Unassign LLM evaluator - first get the dataset_evaluator_id
        async with db() as session:
            llm_dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(llm_eval_name),
                )
            )
            assert llm_dataset_evaluator is not None
            llm_dataset_evaluator_gid = str(
                GlobalID("DatasetEvaluator", str(llm_dataset_evaluator.id))
            )

        result = await gql_client.execute(
            self._UNASSIGN_MUTATION,
            {
                "input": {
                    "datasetId": dataset_id,
                    "datasetEvaluatorId": llm_dataset_evaluator_gid,
                }
            },
        )
        assert result.data and not result.errors
        assert (
            result.data["unassignEvaluatorFromDataset"]["evaluator"]["displayName"] == llm_eval_name
        )

        # Verify LLM evaluator unassigned
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate(llm_eval_name),
                )
            )
            assert dataset_evaluator is None

        # Test 6: Error case - invalid evaluator type
        invalid_evaluator_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": invalid_evaluator_id}},
        )
        assert result.errors
        assert "Invalid evaluator type" in result.errors[0].message

        # Test 7: Error case - nonexistent evaluator
        nonexistent_evaluator_id = str(GlobalID("CodeEvaluator", "999999"))
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": nonexistent_evaluator_id}},
        )
        assert result.errors
        assert "not found" in result.errors[0].message.lower()

    async def test_assign_same_evaluator_with_different_names(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that the same evaluator can be assigned to a dataset multiple times with different names."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        llm_eval_id = str(GlobalID("LLMEvaluator", str(llm_evaluator.id)))
        default_name = llm_evaluator.name.root

        # Verify initial assignment exists
        async with db() as session:
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetEvaluators)
                .where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert count == 1

        # Assign the same evaluator with a custom displayName "correctness"
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": llm_eval_id,
                    "displayName": "correctness",
                }
            },
        )
        assert result.data and not result.errors
        dataset_evaluator_data = result.data["assignEvaluatorToDataset"]["evaluator"]
        assert dataset_evaluator_data["evaluator"]["kind"] == "LLM"

        # Assign the same evaluator with another custom displayName "relevance"
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": llm_eval_id,
                    "displayName": "relevance",
                }
            },
        )
        assert result.data and not result.errors

        # Verify we now have 3 assignments for the same evaluator-dataset pair
        async with db() as session:
            assignments = await session.scalars(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assignment_list = assignments.all()
            assert len(assignment_list) == 3

            names = {a.display_name.root for a in assignment_list}
            assert names == {default_name, "correctness", "relevance"}

        for display_name in [default_name, "correctness", "relevance"]:
            assert await self._is_assigned(db, empty_dataset.id, llm_evaluator.id, display_name)

        # Unassign one of the custom names - first get the dataset_evaluator_id
        async with db() as session:
            correctness_dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                    models.DatasetEvaluators.display_name
                    == IdentifierModel.model_validate("correctness"),
                )
            )
            assert correctness_dataset_evaluator is not None
            correctness_dataset_evaluator_gid = str(
                GlobalID("DatasetEvaluator", str(correctness_dataset_evaluator.id))
            )

        result = await gql_client.execute(
            self._UNASSIGN_MUTATION,
            {
                "input": {
                    "datasetId": dataset_id,
                    "datasetEvaluatorId": correctness_dataset_evaluator_gid,
                }
            },
        )
        assert result.data and not result.errors

        async with db() as session:
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetEvaluators)
                .where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert count == 2

        assert not await self._is_assigned(db, empty_dataset.id, llm_evaluator.id, "correctness")

        for display_name in [default_name, "relevance"]:
            assert await self._is_assigned(db, empty_dataset.id, llm_evaluator.id, display_name)


@pytest.fixture
async def empty_dataset(db: DbSessionFactory) -> AsyncIterator[models.Dataset]:
    """Inserts an empty dataset."""
    dataset = models.Dataset(name=f"test dataset {token_hex(4)}", description="test", metadata_={})
    async with db() as session:
        session.add(dataset)
        await session.flush()
    yield dataset
    async with db() as session:
        await session.execute(sa.delete(models.Dataset).where(models.Dataset.id == dataset.id))


@pytest.fixture
async def code_evaluator(
    db: DbSessionFactory, empty_dataset: models.Dataset
) -> AsyncIterator[models.CodeEvaluator]:
    """Inserts a code evaluator with dataset relationship."""
    evaluator_name = IdentifierModel.model_validate(f"test-code-evaluator-{token_hex(4)}")
    evaluator = models.CodeEvaluator(
        name=evaluator_name,
        description="test code evaluator",
        kind="CODE",
        dataset_evaluators=[
            models.DatasetEvaluators(
                dataset_id=empty_dataset.id,
                display_name=evaluator_name,
                input_mapping={},
            )
        ],
    )
    async with db() as session:
        session.add(evaluator)

    yield evaluator
    async with db() as session:
        await session.execute(
            sa.delete(models.CodeEvaluator).where(models.CodeEvaluator.id == evaluator.id)
        )


@pytest.fixture
async def llm_evaluator(
    db: DbSessionFactory, empty_dataset: models.Dataset
) -> AsyncIterator[models.LLMEvaluator]:
    """Inserts an LLM evaluator with dataset relationship."""
    prompt = models.Prompt(
        name=IdentifierModel.model_validate(f"test-prompt-{token_hex(4)}"),
        description="test prompt",
        prompt_versions=[
            models.PromptVersion(
                template_type=PromptTemplateType.STRING,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptStringTemplate(type="string", template="Test evaluator: {input}"),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai", openai=PromptOpenAIInvocationParametersContent()
                ),
                tools=None,
                response_format=None,
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                metadata_={},
            )
        ],
    )
    evaluator_name = IdentifierModel.model_validate(f"test-llm-evaluator-{token_hex(4)}")
    evaluator = models.LLMEvaluator(
        name=evaluator_name,
        description="test llm evaluator",
        kind="LLM",
        annotation_name="correctness",
        output_config=CategoricalAnnotationConfig(
            type="CATEGORICAL",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            description="correctness description",
            values=[
                CategoricalAnnotationValue(label="correct", score=1.0),
                CategoricalAnnotationValue(label="incorrect", score=0.0),
            ],
        ),
        prompt=prompt,
        dataset_evaluators=[
            models.DatasetEvaluators(
                dataset_id=empty_dataset.id,
                display_name=evaluator_name,
                input_mapping={},
            )
        ],
    )
    async with db() as session:
        session.add(evaluator)

    yield evaluator
    async with db() as session:
        await session.execute(
            sa.delete(models.LLMEvaluator).where(models.LLMEvaluator.id == evaluator.id)
        )
        await session.execute(
            sa.delete(models.PromptVersion).where(models.PromptVersion.prompt_id == prompt.id)
        )
        await session.execute(sa.delete(models.Prompt).where(models.Prompt.id == prompt.id))
