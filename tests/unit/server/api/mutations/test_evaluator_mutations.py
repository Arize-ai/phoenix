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
      mutation($input: CreateLLMEvaluatorInput!) {
        createLlmEvaluator(input: $input) {
          evaluator { id name description kind prompt { id } promptVersion { id } }
          query { __typename } } }
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
        evaluator = result.data["createLlmEvaluator"]["evaluator"]
        assert evaluator["name"] == "test-evaluator" and evaluator["kind"] == "LLM"
        await self._verify_prompt_version_messages(
            gql_client, evaluator["promptVersion"]["id"], "Eval {{input}}"
        )

        # Verify database
        evaluator_id = int(GlobalID.from_id(evaluator["id"]).node_id)
        async with db() as session:
            llm_evaluator = await session.get(models.LLMEvaluator, evaluator_id)
            assert llm_evaluator and llm_evaluator.kind == "LLM"
            dataset_evaluator = await session.scalar(
                select(models.DatasetsEvaluators).where(
                    models.DatasetsEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetsEvaluators.evaluator_id == evaluator_id,
                )
            )
            assert dataset_evaluator and dataset_evaluator.input_config == {}

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
        evaluator = result.data["createLlmEvaluator"]["evaluator"]
        await self._verify_prompt_version_messages(
            gql_client, evaluator["promptVersion"]["id"], "Rate"
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
        evaluator = result.data["createLlmEvaluator"]["evaluator"]
        await self._verify_prompt_version_messages(
            gql_client, evaluator["promptVersion"]["id"], "Second"
        )
        async with db() as session:
            evaluators = await session.scalars(
                select(models.DatasetsEvaluators).where(
                    models.DatasetsEvaluators.dataset_id == empty_dataset.id
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


class TestCreateEvaluatorsWithoutDataset:
    _CREATE_LLM_EVALUATOR_MUTATION = """
      mutation($input: CreateLLMEvaluatorInput!) {
        createLlmEvaluator(input: $input) {
          evaluator { id name kind prompt { id } promptVersion { id } }
          query { __typename }
        }
      }
    """

    _CREATE_CODE_EVALUATOR_MUTATION = """
      mutation($input: CreateCodeEvaluatorInput!) {
        createCodeEvaluator(input: $input) {
          evaluator { id name kind }
          query { __typename }
        }
      }
    """

    async def test_create_llm_evaluator_without_dataset_relation(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_LLM_EVALUATOR_MUTATION,
            {
                "input": dict(
                    name="llm-no-dataset",
                    description="llm eval without dataset relation",
                    promptVersion=dict(
                        description="pv",
                        templateFormat="MUSTACHE",
                        template=dict(
                            messages=[dict(role="USER", content=[dict(text=dict(text="Hello"))])]
                        ),
                        invocationParameters=dict(
                            temperature=0.0,
                            tool_choice=dict(
                                type="function",
                                function=dict(name="llm-no-dataset"),
                            ),
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="llm-no-dataset",
                                        description="llm eval without dataset relation",
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
            },
        )
        assert result.data and not result.errors
        evaluator = result.data["createLlmEvaluator"]["evaluator"]
        assert evaluator["kind"] == "LLM"

        evaluator_id = int(GlobalID.from_id(evaluator["id"]).node_id)
        async with db() as session:
            # Ensure no dataset-evaluator relation was created
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetsEvaluators)
                .where(models.DatasetsEvaluators.evaluator_id == evaluator_id)
            )
            assert count == 0


class TestAssignUnassignEvaluatorMutations:
    _ASSIGN_MUTATION = """
      mutation($input: AssignEvaluatorToDatasetInput!) {
        assignEvaluatorToDataset(input: $input) {
          evaluator {
            id
            name
            kind
            ... on LLMEvaluator { prompt { id } }
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
            name
            kind
          }
          query { __typename }
        }
      }
    """

    _IS_ASSIGNED_QUERY = """
      query($evaluatorId: ID!, $datasetId: ID!) {
        node(id: $evaluatorId) {
          ... on Evaluator {
            isAssignedToDataset(datasetId: $datasetId)
          }
        }
      }
    """

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

        # Test 1: Verify evaluators are already assigned (via ORM relationship in fixtures)
        result = await gql_client.execute(
            self._IS_ASSIGNED_QUERY,
            {"evaluatorId": code_eval_id, "datasetId": dataset_id},
        )
        assert result.data and not result.errors
        assert result.data["node"]["isAssignedToDataset"] is True

        # Verify LLM evaluator is also already assigned (via ORM relationship in fixtures)
        result = await gql_client.execute(
            self._IS_ASSIGNED_QUERY,
            {"evaluatorId": llm_eval_id, "datasetId": dataset_id},
        )
        assert result.data and not result.errors
        assert result.data["node"]["isAssignedToDataset"] is True

        # Test 2: Idempotency - assign code evaluator again (already assigned)
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": code_eval_id}},
        )
        assert result.data and not result.errors
        evaluator_data = result.data["assignEvaluatorToDataset"]["evaluator"]
        assert evaluator_data["kind"] == "CODE"
        assert evaluator_data["name"] == code_evaluator.name.root

        # Verify only one assignment exists (idempotency)
        async with db() as session:
            count = await session.scalar(
                select(sa.func.count())
                .select_from(models.DatasetsEvaluators)
                .where(
                    models.DatasetsEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetsEvaluators.evaluator_id == code_evaluator.id,
                )
            )
            assert count == 1

        # Test 3: Idempotency for LLM evaluator (already assigned)
        result = await gql_client.execute(
            self._ASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": llm_eval_id}},
        )
        assert result.data and not result.errors
        evaluator_data = result.data["assignEvaluatorToDataset"]["evaluator"]
        assert evaluator_data["kind"] == "LLM"
        assert "prompt" in evaluator_data

        # Test 4: Unassign code evaluator
        result = await gql_client.execute(
            self._UNASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": code_eval_id}},
        )
        assert result.data and not result.errors
        assert result.data["unassignEvaluatorFromDataset"]["evaluator"]["kind"] == "CODE"

        # Verify code evaluator unassigned
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetsEvaluators).where(
                    models.DatasetsEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetsEvaluators.evaluator_id == code_evaluator.id,
                )
            )
            assert dataset_evaluator is None

        result = await gql_client.execute(
            self._IS_ASSIGNED_QUERY,
            {"evaluatorId": code_eval_id, "datasetId": dataset_id},
        )
        assert result.data and not result.errors
        assert result.data["node"]["isAssignedToDataset"] is False

        # Test 5: Unassign LLM evaluator
        result = await gql_client.execute(
            self._UNASSIGN_MUTATION,
            {"input": {"datasetId": dataset_id, "evaluatorId": llm_eval_id}},
        )
        assert result.data and not result.errors
        assert result.data["unassignEvaluatorFromDataset"]["evaluator"]["kind"] == "LLM"

        # Verify LLM evaluator unassigned
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetsEvaluators).where(
                    models.DatasetsEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetsEvaluators.evaluator_id == llm_evaluator.id,
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
    evaluator = models.CodeEvaluator(
        name=IdentifierModel.model_validate(f"test-code-evaluator-{token_hex(4)}"),
        description="test code evaluator",
        kind="CODE",
        datasets_evaluators=[
            models.DatasetsEvaluators(
                dataset_id=empty_dataset.id,
                input_config={},
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
    evaluator = models.LLMEvaluator(
        name=IdentifierModel.model_validate(f"test-llm-evaluator-{token_hex(4)}"),
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
        datasets_evaluators=[
            models.DatasetsEvaluators(
                dataset_id=empty_dataset.id,
                input_config={},
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
