from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.evaluators import get_builtin_evaluator_ids
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    TextContentPart,
    normalize_tools,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
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
                                        label=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                            description="correctness",
                                        )
                                    ),
                                    required=["label"],
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
                                    label=dict(
                                        type="string",
                                        enum=["correct", "incorrect"],
                                        description="correctness",
                                    )
                                ),
                                required=["label"],
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
                                    label=dict(
                                        type="string",
                                        enum=["correct", "incorrect"],
                                        description="correctness",
                                    )
                                ),
                                required=["label"],
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
                                        label=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                            description="correctness",
                                        )
                                    ),
                                    required=["label"],
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

    async def test_create_dataset_llm_evaluator_with_existing_prompt_version(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test creating evaluator with existing prompt_version_id."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # First, create a prompt and prompt version
        async with db() as session:
            prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"test-prompt-{token_hex(4)}"),
                description="test prompt",
                prompt_versions=[
                    models.PromptVersion(
                        template_type=PromptTemplateType.CHAT,
                        template_format=PromptTemplateFormat.MUSTACHE,
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[
                                        TextContentPart(
                                            type="text",
                                            text="Original: {{input}}",
                                        )
                                    ],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(temperature=0.0),
                        ),
                        tools=normalize_tools(
                            [
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "original-evaluator",
                                        "description": "original description",
                                        "parameters": {
                                            "type": "object",
                                            "properties": {
                                                "correctness": {
                                                    "type": "string",
                                                    "enum": ["correct", "incorrect"],
                                                }
                                            },
                                            "required": ["correctness"],
                                        },
                                    },
                                }
                            ],
                            ModelProvider.OPENAI,
                            tool_choice={
                                "type": "function",
                                "function": {"name": "original-evaluator"},
                            },
                        ),
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            session.add(prompt)
            await session.flush()
            existing_prompt_version = prompt.prompt_versions[0]
            existing_prompt_version_id = str(
                GlobalID("PromptVersion", str(existing_prompt_version.id))
            )
            existing_prompt_id = prompt.id

        # Create evaluator with different prompt contents
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="test-evaluator-different",
            description="test description",
            promptVersionId=existing_prompt_version_id,
            promptVersion=dict(
                description=None,
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[
                        dict(role="USER", content=[dict(text=dict(text="Updated: {{input}}"))])
                    ]
                ),
                invocationParameters=dict(
                    temperature=0.5,  # Different temperature
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test-evaluator-different"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test-evaluator-different",
                                description="test description",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        label=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                            description="correctness",
                                        )
                                    ),
                                    required=["label"],
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

        # Verify the evaluator uses the existing prompt but new prompt version
        async with db() as session:
            dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            llm_evaluator = await session.get(
                models.LLMEvaluator,
                db_dataset_evaluator.evaluator_id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            # breakpoint()
            assert llm_evaluator is not None
            # Verify prompt ID matches the existing prompt
            assert llm_evaluator.prompt_id == existing_prompt_id
            # Verify prompt version ID is different (new version created)
            assert llm_evaluator.prompt_version_tag is not None
            new_prompt_version_id = llm_evaluator.prompt_version_tag.prompt_version_id
            assert new_prompt_version_id != existing_prompt_version.id
            # Verify tag was added to the new prompt version
            assert llm_evaluator.prompt_version_tag.prompt_id == existing_prompt_id

            # Verify two prompt versions exist (original + new)
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(
                    models.PromptVersion.prompt_id == existing_prompt_id
                )
            )
            prompt_versions_list = prompt_versions.all()
            assert len(prompt_versions_list) == 2
            # Verify the new version has the updated content
            new_version = next(
                (v for v in prompt_versions_list if v.id == new_prompt_version_id), None
            )
            assert new_version is not None
            # Verify template is a chat template and has the updated content
            assert isinstance(new_version.template, PromptChatTemplate)
            assert (
                new_version.template.messages[0].content[0].text == "Updated: {{input}}"  # type: ignore[union-attr]
            )

    async def test_create_dataset_llm_evaluator_without_prompt_version_id(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test creating evaluator without prompt_version_id (existing behavior)."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Create evaluator without prompt_version_id
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="test-evaluator-new",
            description="test description",
            promptVersion=dict(
                description=None,
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[dict(role="USER", content=[dict(text=dict(text="New: {{input}}"))])]
                ),
                invocationParameters=dict(
                    temperature=0.0,
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test-evaluator-new"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test-evaluator-new",
                                description="test description",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        label=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                            description="correctness",
                                        )
                                    ),
                                    required=["label"],
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

        # Verify a new prompt and prompt version were created
        async with db() as session:
            dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            llm_evaluator = await session.get(
                models.LLMEvaluator,
                db_dataset_evaluator.evaluator_id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert llm_evaluator is not None
            # Verify prompt exists
            prompt = await session.get(models.Prompt, llm_evaluator.prompt_id)
            assert prompt is not None
            # Verify prompt version exists and tag was added
            assert llm_evaluator.prompt_version_tag is not None
            prompt_version = await session.get(
                models.PromptVersion, llm_evaluator.prompt_version_tag.prompt_version_id
            )
            assert prompt_version is not None
            assert prompt_version.prompt_id == prompt.id
            # Verify only one prompt version exists for this prompt
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(models.PromptVersion.prompt_id == prompt.id)
            )
            assert len(prompt_versions.all()) == 1

    async def test_create_dataset_llm_evaluator_with_nonexistent_prompt_version_id(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test creating evaluator with nonexistent prompt_version_id raises error."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        nonexistent_prompt_version_id = str(GlobalID("PromptVersion", "999999"))

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="test-evaluator-error",
            description="test description",
            promptVersionId=nonexistent_prompt_version_id,
            promptVersion=dict(
                description=None,
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[dict(role="USER", content=[dict(text=dict(text="Test: {{input}}"))])]
                ),
                invocationParameters=dict(
                    temperature=0.0,
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test-evaluator-error"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test-evaluator-error",
                                description="test description",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        label=dict(
                                            type="string",
                                            enum=["correct", "incorrect"],
                                            description="correctness",
                                        )
                                    ),
                                    required=["label"],
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
        assert result.errors
        assert "not found" in result.errors[0].message.lower()


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
                                dict(
                                    role="USER",
                                    content=[dict(text=dict(text="Updated: {{input}}"))],
                                )
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
                                                label=dict(
                                                    type="string",
                                                    enum=["good", "bad"],
                                                    description="result",
                                                )
                                            ),
                                            required=["label"],
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


class TestCreateDatasetBuiltinEvaluatorMutation:
    _MUTATION = """
      mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
        createDatasetBuiltinEvaluator(input: $input) {
          evaluator {
            id
            displayName
            evaluator {
              ... on BuiltInEvaluator {
                id
                name
                description
                kind
              }
            }
          }
          query { __typename }
        }
      }
    """

    async def _create(self, gql_client: AsyncGraphQLClient, **input_fields: Any) -> Any:
        """Private helper to execute create mutation with given input fields."""
        return await gql_client.execute(self._MUTATION, {"input": input_fields})

    async def test_create_dataset_builtin_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Get a valid builtin evaluator ID
        builtin_evaluator_ids = get_builtin_evaluator_ids()
        assert len(builtin_evaluator_ids) > 0, "No builtin evaluators available for testing"
        builtin_evaluator_id = builtin_evaluator_ids[0]
        builtin_evaluator_gid = str(GlobalID("BuiltInEvaluator", str(builtin_evaluator_id)))

        # Success: Create builtin evaluator with default input_mapping
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=builtin_evaluator_gid,
            displayName="test-builtin-evaluator",
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetBuiltinEvaluator"]["evaluator"]
        builtin_evaluator_data = dataset_evaluator["evaluator"]
        assert dataset_evaluator["displayName"] == "test-builtin-evaluator"
        assert builtin_evaluator_data["kind"] == "CODE"

        dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.builtin_evaluator_id == builtin_evaluator_id
            assert db_dataset_evaluator.evaluator_id is None
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {},
                "path_mapping": {},
            }

        # Success: Create builtin evaluator with custom input_mapping
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=builtin_evaluator_gid,
            displayName="test-builtin-evaluator-2",
            inputMapping=dict(
                literalMapping={"key": "value"},
                pathMapping={"input": "context.input"},
            ),
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetBuiltinEvaluator"]["evaluator"]
        assert dataset_evaluator["displayName"] == "test-builtin-evaluator-2"

        dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {"key": "value"},
                "path_mapping": {"input": "context.input"},
            }

        # Success: Multiple builtin evaluators for same dataset
        if len(builtin_evaluator_ids) > 1:
            second_builtin_evaluator_id = builtin_evaluator_ids[1]
            second_builtin_evaluator_gid = str(
                GlobalID("BuiltInEvaluator", str(second_builtin_evaluator_id))
            )
            result = await self._create(
                gql_client,
                datasetId=dataset_id,
                evaluatorId=second_builtin_evaluator_gid,
                displayName="test-builtin-evaluator-3",
            )
            assert result.data and not result.errors

            async with db() as session:
                evaluators = await session.scalars(
                    select(models.DatasetEvaluators).where(
                        models.DatasetEvaluators.dataset_id == empty_dataset.id,
                        models.DatasetEvaluators.builtin_evaluator_id.isnot(None),
                    )
                )
                assert len(evaluators.all()) >= 2

        # Failure: Nonexistent dataset
        result = await self._create(
            gql_client,
            datasetId=str(GlobalID("Dataset", "999")),
            evaluatorId=builtin_evaluator_gid,
            displayName="test",
        )
        assert result.errors and "Dataset with id" in result.errors[0].message

        # Failure: Invalid evaluator type (not BuiltInEvaluator)
        invalid_evaluator_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=invalid_evaluator_id,
            displayName="test",
        )
        assert result.errors and "Invalid evaluator" in result.errors[0].message

        # Failure: Nonexistent builtin evaluator
        nonexistent_builtin_id = -999999
        nonexistent_builtin_gid = str(GlobalID("BuiltInEvaluator", str(nonexistent_builtin_id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=nonexistent_builtin_gid,
            displayName="test",
        )
        assert result.errors and "not found" in result.errors[0].message.lower()

        # Failure: Positive evaluator ID (builtin evaluator IDs must be negative)
        positive_id = 123
        positive_id_gid = str(GlobalID("BuiltInEvaluator", str(positive_id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=positive_id_gid,
            displayName="test",
        )
        assert result.errors and "Invalid built-in evaluator id" in result.errors[0].message

        # Failure: Duplicate display name for same dataset
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=builtin_evaluator_gid,
            displayName="test-builtin-evaluator",  # Same as first one
        )
        assert result.errors and "already exists" in result.errors[0].message.lower()


class TestUpdateDatasetBuiltinEvaluatorMutation:
    _UPDATE_MUTATION = """
      mutation($input: UpdateDatasetBuiltinEvaluatorInput!) {
        updateDatasetBuiltinEvaluator(input: $input) {
          evaluator {
            id
            displayName
            evaluator {
              ... on BuiltInEvaluator {
                id
                name
                description
                kind
              }
            }
          }
          query { __typename }
        }
      }
    """

    async def test_update_dataset_builtin_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test updating a builtin evaluator via its DatasetEvaluator assignment."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Get a valid builtin evaluator ID
        builtin_evaluator_ids = get_builtin_evaluator_ids()
        assert len(builtin_evaluator_ids) > 0, "No builtin evaluators available for testing"
        builtin_evaluator_id = builtin_evaluator_ids[0]
        builtin_evaluator_gid = str(GlobalID("BuiltInEvaluator", str(builtin_evaluator_id)))

        # First, create a builtin evaluator to update
        create_result = await gql_client.execute(
            """
            mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
              createDatasetBuiltinEvaluator(input: $input) {
                evaluator {
                  id
                  displayName
                }
              }
            }
            """,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": builtin_evaluator_gid,
                    "displayName": "original-name",
                    "inputMapping": dict(
                        literalMapping={"key": "original"},
                        pathMapping={"input": "context.original"},
                    ),
                }
            },
        )
        assert create_result.data and not create_result.errors
        dataset_evaluator_id = create_result.data["createDatasetBuiltinEvaluator"]["evaluator"][
            "id"
        ]

        # Update the evaluator with new display name
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "displayName": "updated-name",
                }
            },
        )
        assert result.data and not result.errors

        updated_evaluator = result.data["updateDatasetBuiltinEvaluator"]["evaluator"]
        assert updated_evaluator["displayName"] == "updated-name"
        builtin_data = updated_evaluator["evaluator"]
        assert builtin_data["kind"] == "CODE"

        # Verify database state
        dataset_evaluator_rowid = int(GlobalID.from_id(dataset_evaluator_id).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_rowid
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.display_name.root == "updated-name"
            # Input mapping should revert to default value when not provided
            assert db_dataset_evaluator.input_mapping == EvaluatorInputMappingInput().to_dict()

        # Update the evaluator with new input_mapping
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "displayName": "updated-name",
                    "inputMapping": dict(
                        literalMapping={"new_key": "new_value"},
                        pathMapping={"output": "context.output"},
                    ),
                }
            },
        )
        assert result.data and not result.errors

        async with db() as session:
            db_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_rowid
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {"new_key": "new_value"},
                "path_mapping": {"output": "context.output"},
            }

        # Update both display name and input_mapping
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "displayName": "final-name",
                    "inputMapping": dict(
                        literalMapping={"final": "value"},
                        pathMapping={},
                    ),
                }
            },
        )
        assert result.data and not result.errors

        updated_evaluator = result.data["updateDatasetBuiltinEvaluator"]["evaluator"]
        assert updated_evaluator["displayName"] == "final-name"

        async with db() as session:
            db_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_rowid
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.display_name.root == "final-name"
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {"final": "value"},
                "path_mapping": {},
            }

        # Failure: Nonexistent dataset evaluator
        nonexistent_id = str(GlobalID("DatasetEvaluator", "999999"))
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": nonexistent_id,
                    "displayName": "test",
                }
            },
        )
        assert result.errors and "not found" in result.errors[0].message.lower()

        # Failure: Try to update a non-builtin evaluator (LLM evaluator)
        # First create an LLM evaluator
        prompt = models.Prompt(
            name=IdentifierModel.model_validate(f"test-prompt-{token_hex(4)}"),
            description="test prompt",
            prompt_versions=[
                models.PromptVersion(
                    template_type=PromptTemplateType.STRING,
                    template_format=PromptTemplateFormat.F_STRING,
                    template=PromptStringTemplate(type="string", template="Test: {input}"),
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
        llm_evaluator_name = IdentifierModel.model_validate(f"test-llm-eval-{token_hex(4)}")
        llm_evaluator = models.LLMEvaluator(
            name=llm_evaluator_name,
            description="test llm evaluator",
            kind="LLM",
            annotation_name="test",
            output_config=CategoricalAnnotationConfig(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                description="test description",
                values=[
                    CategoricalAnnotationValue(label="good", score=1.0),
                    CategoricalAnnotationValue(label="bad", score=0.0),
                ],
            ),
            prompt=prompt,
            dataset_evaluators=[
                models.DatasetEvaluators(
                    dataset_id=empty_dataset.id,
                    display_name=llm_evaluator_name,
                    input_mapping={},
                )
            ],
        )
        async with db() as session:
            session.add(llm_evaluator)
            await session.flush()
            llm_dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert llm_dataset_evaluator is not None
            llm_dataset_evaluator_id = str(
                GlobalID("DatasetEvaluator", str(llm_dataset_evaluator.id))
            )

        # Try to update the LLM evaluator (should fail)
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": llm_dataset_evaluator_id,
                    "displayName": "updated-llm-name",
                }
            },
        )
        assert result.errors and "non-built-in evaluator" in result.errors[0].message.lower()

        # Cleanup
        async with db() as session:
            await session.execute(
                sa.delete(models.LLMEvaluator).where(models.LLMEvaluator.id == llm_evaluator.id)
            )
            await session.execute(
                sa.delete(models.PromptVersion).where(models.PromptVersion.prompt_id == prompt.id)
            )
            await session.execute(sa.delete(models.Prompt).where(models.Prompt.id == prompt.id))

        # Failure: Duplicate display name (create another builtin evaluator first)
        if len(builtin_evaluator_ids) > 1:
            second_builtin_evaluator_id = builtin_evaluator_ids[1]
            second_builtin_evaluator_gid = str(
                GlobalID("BuiltInEvaluator", str(second_builtin_evaluator_id))
            )
            create_result2 = await gql_client.execute(
                """
                mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
                  createDatasetBuiltinEvaluator(input: $input) {
                    evaluator {
                      id
                      displayName
                    }
                  }
                }
                """,
                {
                    "input": {
                        "datasetId": dataset_id,
                        "evaluatorId": second_builtin_evaluator_gid,
                        "displayName": "other-evaluator",
                    }
                },
            )
            assert create_result2.data and not create_result2.errors

            # Try to update the first evaluator to have the same name as the second
            result = await gql_client.execute(
                self._UPDATE_MUTATION,
                {
                    "input": {
                        "datasetEvaluatorId": dataset_evaluator_id,
                        "displayName": "other-evaluator",  # Same as second evaluator
                    }
                },
            )
            assert result.errors and "already exists" in result.errors[0].message.lower()


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
