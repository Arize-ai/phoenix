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
    denormalize_tools,
    get_raw_invocation_parameters,
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
            name
            description
            outputConfig {
              ... on CategoricalAnnotationConfig {
                name
                description
                values { label score }
              }
              ... on ContinuousAnnotationConfig {
                name
                description
                lowerBound
                upperBound
              }
            }
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

    async def test_create_dataset_llm_evaluator_basic(
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
        assert dataset_evaluator["name"] == "test-evaluator"
        assert dataset_evaluator["description"] == "test description"
        assert dataset_evaluator["outputConfig"]["name"] == "test-evaluator"
        assert dataset_evaluator["outputConfig"]["description"] == "test description"
        assert len(dataset_evaluator["outputConfig"]["values"]) == 2
        assert llm_evaluator_data["kind"] == "LLM"
        await self._verify_prompt_version_messages(
            gql_client, llm_evaluator_data["promptVersion"]["id"], "Eval {{input}}"
        )

        dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.evaluator_id is not None
            # user_id is None when authentication is disabled
            assert db_dataset_evaluator.user_id is None
            llm_evaluator = await session.get(
                models.LLMEvaluator, db_dataset_evaluator.evaluator_id
            )
            assert llm_evaluator and llm_evaluator.kind == "LLM"
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {},
                "path_mapping": {},
            }
            assert db_dataset_evaluator.description == "test description"
            assert db_dataset_evaluator.output_config_override is None
            assert llm_evaluator.output_config is not None
            assert llm_evaluator.output_config.name == "correctness"
            assert len(llm_evaluator.output_config.values) == 2

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

    async def test_create_dataset_llm_evaluator_with_identical_prompt_content(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test creating evaluator with existing prompt_version_id and identical content doesn't create new version."""
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
                            openai=PromptOpenAIInvocationParametersContent(temperature=0.5),
                        ),
                        tools=normalize_tools(
                            [
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "test-evaluator-identical",
                                        "description": "test description",
                                        "parameters": {
                                            "type": "object",
                                            "properties": {
                                                "label": {
                                                    "type": "string",
                                                    "enum": ["correct", "incorrect"],
                                                    "description": "correctness",
                                                }
                                            },
                                            "required": ["label"],
                                        },
                                    },
                                }
                            ],
                            ModelProvider.OPENAI,
                            tool_choice={
                                "type": "function",
                                "function": {"name": "test-evaluator-identical"},
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

        # Create evaluator with identical prompt contents
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="test-evaluator-identical",
            description="test description",
            promptVersionId=existing_prompt_version_id,
            promptVersion=dict(
                description=None,
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[
                        dict(role="USER", content=[dict(text=dict(text="Original: {{input}}"))])
                    ]
                ),
                invocationParameters=dict(
                    temperature=0.5,  # Same temperature as existing
                    tool_choice=dict(
                        type="function",
                        function=dict(name="test-evaluator-identical"),
                    ),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="test-evaluator-identical",
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

        # Verify the evaluator uses the existing prompt and SAME prompt version (no new version created)
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
            # Verify prompt ID matches the existing prompt
            assert llm_evaluator.prompt_id == existing_prompt_id
            # Verify prompt version ID is the SAME (no new version created)
            assert llm_evaluator.prompt_version_tag is not None
            assert llm_evaluator.prompt_version_tag.prompt_version_id == existing_prompt_version.id
            # Verify tag was added to the existing prompt version
            assert llm_evaluator.prompt_version_tag.prompt_id == existing_prompt_id

            # Verify only ONE prompt version exists (no new one created)
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(
                    models.PromptVersion.prompt_id == existing_prompt_id
                )
            )
            prompt_versions_list = prompt_versions.all()
            assert len(prompt_versions_list) == 1

    async def test_create_dataset_llm_evaluator_creates_evaluator_label(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test that creating an LLM evaluator labels its prompt with 'evaluator'."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="label-test",
            description="desc",
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content=[dict(text=dict(text="x"))])]),
                invocationParameters=dict(
                    tool_choice=dict(type="function", function=dict(name="label-test"))
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="label-test",
                                description="desc",
                                parameters=dict(
                                    type="object",
                                    properties=dict(
                                        label=dict(
                                            type="string", enum=["a", "b"], description="out"
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
                name="out",
                optimizationDirection="MAXIMIZE",
                values=[dict(label="a", score=1), dict(label="b", score=0)],
            ),
        )
        assert result.data and not result.errors

        # Verify the prompt has the "evaluator" label
        async with db() as session:
            evaluator_id = int(
                GlobalID.from_id(
                    result.data["createDatasetLlmEvaluator"]["evaluator"]["id"]
                ).node_id
            )
            de = await session.get(models.DatasetEvaluators, evaluator_id)
            assert de is not None
            llm_eval = await session.get(models.LLMEvaluator, de.evaluator_id)
            assert llm_eval is not None

            assoc = await session.scalar(
                select(models.PromptPromptLabel).where(
                    models.PromptPromptLabel.prompt_id == llm_eval.prompt_id
                )
            )
            assert assoc is not None
            label = await session.get(models.PromptLabel, assoc.prompt_label_id)
            assert label is not None
            assert label.name == "evaluator"

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

    async def test_create_llm_evaluators_with_same_name_on_different_datasets(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test that creating evaluators with the same name on different datasets succeeds."""
        async with db() as session:
            second_dataset = models.Dataset(name=f"second-dataset-{token_hex(4)}", metadata_={})
            session.add(second_dataset)
            await session.flush()
            second_dataset_id = second_dataset.id

        dataset1_gid = str(GlobalID("Dataset", str(empty_dataset.id)))
        dataset2_gid = str(GlobalID("Dataset", str(second_dataset_id)))

        evaluator_input = dict(
            description="test description",
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(
                    messages=[dict(role="USER", content=[dict(text=dict(text="Eval {{input}}"))])]
                ),
                invocationParameters=dict(
                    temperature=0.0,
                    tool_choice=dict(type="function", function=dict(name="my-evaluator")),
                ),
                tools=[
                    dict(
                        definition=dict(
                            type="function",
                            function=dict(
                                name="my-evaluator",
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
                description="correctness eval",
                optimizationDirection="MAXIMIZE",
                values=[
                    dict(label="correct", score=1),
                    dict(label="incorrect", score=0),
                ],
            ),
        )

        result1 = await self._create(
            gql_client,
            datasetId=dataset1_gid,
            name="my-evaluator",
            **evaluator_input,
        )
        assert result1.data and not result1.errors

        result2 = await self._create(
            gql_client,
            datasetId=dataset2_gid,
            name="my-evaluator",
            **evaluator_input,
        )
        assert result2.data and not result2.errors

        assert result1.data["createDatasetLlmEvaluator"]["evaluator"]["name"] == "my-evaluator"
        assert result2.data["createDatasetLlmEvaluator"]["evaluator"]["name"] == "my-evaluator"

        name1 = result1.data["createDatasetLlmEvaluator"]["evaluator"]["evaluator"]["name"]
        name2 = result2.data["createDatasetLlmEvaluator"]["evaluator"]["evaluator"]["name"]
        assert name1 != name2


class TestUpdateDatasetLLMEvaluatorMutation:
    _UPDATE_MUTATION = """
      mutation($input: UpdateDatasetLLMEvaluatorInput!) {
        updateDatasetLlmEvaluator(input: $input) {
          evaluator {
            id
            name
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
        assert updated_evaluator["name"] == "updated-evaluator-name"
        llm_data = updated_evaluator["evaluator"]
        assert llm_data["description"] == "updated description"
        assert llm_data["kind"] == "LLM"

        async with db() as session:
            db_evaluator = await session.get(models.LLMEvaluator, llm_evaluator.id)
            assert db_evaluator is not None
            assert db_evaluator.description == "updated description"
            # user_id is None when authentication is disabled
            assert db_evaluator.user_id is None
            db_dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id
                )
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.output_config_override is None
            # user_id is None when authentication is disabled
            assert db_dataset_evaluator.user_id is None
            assert db_evaluator.output_config.name == "result"

    async def test_update_without_prompt_version_id_creates_new_prompt(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that updating without prompt_version_id creates a new prompt and version."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        original_prompt_id = llm_evaluator.prompt_id

        # Get the dataset_evaluator ID
        async with db() as session:
            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))
            original_prompt = await session.get(models.Prompt, original_prompt_id)
            assert original_prompt is not None

        # Update without prompt_version_id
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": "updated-evaluator",
                    "description": "updated description",
                    "promptVersion": dict(
                        description="new prompt version",
                        templateFormat="MUSTACHE",
                        template=dict(
                            messages=[
                                dict(
                                    role="USER",
                                    content=[dict(text=dict(text="New prompt: {{input}}"))],
                                )
                            ]
                        ),
                        invocationParameters=dict(
                            temperature=0.7,
                            tool_choice="required",
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="updated-evaluator",
                                        description="updated description",
                                        parameters=dict(
                                            type="object",
                                            properties=dict(
                                                label=dict(
                                                    type="string",
                                                    enum=["yes", "no"],
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
                        description="description",
                        optimizationDirection="MAXIMIZE",
                        values=[
                            dict(label="yes", score=1),
                            dict(label="no", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        # Verify a new prompt and version were created
        async with db() as session:
            db_evaluator = await session.get(
                models.LLMEvaluator,
                llm_evaluator.id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert db_evaluator is not None
            # Verify prompt_id changed (new prompt created)
            assert db_evaluator.prompt_id != original_prompt_id
            new_prompt = await session.get(models.Prompt, db_evaluator.prompt_id)
            assert new_prompt is not None
            # Verify prompt_version_tag exists and points to new prompt
            assert db_evaluator.prompt_version_tag is not None
            assert db_evaluator.prompt_version_tag.prompt_id == db_evaluator.prompt_id
            # Verify only one version exists for the new prompt
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(
                    models.PromptVersion.prompt_id == db_evaluator.prompt_id
                )
            )
            assert len(prompt_versions.all()) == 1
            # Verify the version has the new content
            new_version = await session.get(
                models.PromptVersion, db_evaluator.prompt_version_tag.prompt_version_id
            )
            assert new_version is not None
            assert isinstance(new_version.template, PromptChatTemplate)
            assert (
                new_version.template.messages[0].content[0].text == "New prompt: {{input}}"  # type: ignore[union-attr]
            )

    async def test_update_with_prompt_version_id_different_prompt(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that updating with prompt_version_id pointing to different prompt switches prompts."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        original_prompt_id = llm_evaluator.prompt_id

        # Create a different prompt with a version
        async with db() as session:
            different_prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"different-prompt-{token_hex(4)}"),
                description="different prompt",
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
                                            text="Different: {{input}}",
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
                                        "name": "different-tool",
                                        "description": "different",
                                        "parameters": {
                                            "type": "object",
                                            "properties": {
                                                "label": {
                                                    "type": "string",
                                                    "enum": ["yes", "no"],
                                                    "description": "result",
                                                }
                                            },
                                            "required": ["label"],
                                        },
                                    },
                                }
                            ],
                            ModelProvider.OPENAI,
                            tool_choice="required",
                        ),
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            session.add(different_prompt)
            await session.flush()
            different_prompt_version_id = str(
                GlobalID("PromptVersion", str(different_prompt.prompt_versions[0].id))
            )
            different_prompt_id = different_prompt.id

            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))

        # Update with prompt_version_id pointing to different prompt
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": "updated-evaluator",
                    "description": "updated description",
                    "promptVersionId": different_prompt_version_id,
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
                            tool_choice="required",
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="updated-evaluator",
                                        description="updated description",
                                        parameters=dict(
                                            type="object",
                                            properties=dict(
                                                label=dict(
                                                    type="string",
                                                    enum=["yes", "no"],
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
                        description="description",
                        optimizationDirection="MAXIMIZE",
                        values=[
                            dict(label="yes", score=1),
                            dict(label="no", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        # Verify evaluator switched to different prompt
        async with db() as session:
            db_evaluator = await session.get(
                models.LLMEvaluator,
                llm_evaluator.id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert db_evaluator is not None
            # Verify prompt_id changed to different prompt
            assert db_evaluator.prompt_id == different_prompt_id
            assert db_evaluator.prompt_id != original_prompt_id
            # Verify prompt_version_tag points to different prompt
            assert db_evaluator.prompt_version_tag is not None
            assert db_evaluator.prompt_version_tag.prompt_id == different_prompt_id

    async def test_update_with_prompt_version_id_content_changed(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that updating with prompt_version_id but changed content creates new version."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Get the current prompt version
        async with db() as session:
            current_prompt_version = await session.scalar(
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == llm_evaluator.prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
            assert current_prompt_version is not None
            current_prompt_version_id = str(
                GlobalID("PromptVersion", str(current_prompt_version.id))
            )
            original_prompt_id = llm_evaluator.prompt_id

            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))

        # Update with prompt_version_id but different content
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": "updated-evaluator",
                    "description": "updated description",
                    "promptVersionId": current_prompt_version_id,
                    "promptVersion": dict(
                        description="changed content",
                        templateFormat="MUSTACHE",
                        template=dict(
                            messages=[
                                dict(
                                    role="USER",
                                    content=[dict(text=dict(text="Changed: {{input}}"))],
                                )
                            ]
                        ),
                        invocationParameters=dict(
                            temperature=0.8,  # Different temperature
                            tool_choice="required",
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="updated-evaluator",
                                        description="updated description",
                                        parameters=dict(
                                            type="object",
                                            properties=dict(
                                                label=dict(
                                                    type="string",
                                                    enum=["yes", "no"],
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
                        description="description",
                        optimizationDirection="MAXIMIZE",
                        values=[
                            dict(label="yes", score=1),
                            dict(label="no", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        # Verify new version was created
        async with db() as session:
            db_evaluator = await session.get(
                models.LLMEvaluator,
                llm_evaluator.id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert db_evaluator is not None
            # Verify prompt_id stayed the same
            assert db_evaluator.prompt_id == original_prompt_id
            # Verify prompt_version_tag points to new version
            assert db_evaluator.prompt_version_tag is not None
            new_version_id = db_evaluator.prompt_version_tag.prompt_version_id
            assert new_version_id != current_prompt_version.id
            # Verify new version has changed content
            new_version = await session.get(models.PromptVersion, new_version_id)
            assert new_version is not None
            assert isinstance(new_version.template, PromptChatTemplate)
            assert (
                new_version.template.messages[0].content[0].text == "Changed: {{input}}"  # type: ignore[union-attr]
            )

    async def test_update_with_prompt_version_id_content_unchanged(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that updating with prompt_version_id and unchanged content doesn't create new version."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        # Get the current prompt version and extract all fields to match exactly
        async with db() as session:
            current_prompt_version = await session.scalar(
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == llm_evaluator.prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
            assert current_prompt_version is not None
            current_prompt_version_id = str(
                GlobalID("PromptVersion", str(current_prompt_version.id))
            )
            original_prompt_id = llm_evaluator.prompt_id

            # Extract invocation parameters (need raw dict, not the typed object)
            raw_invocation_parameters = get_raw_invocation_parameters(
                current_prompt_version.invocation_parameters
            )

            # Extract tools (convert to GraphQL format)
            assert current_prompt_version.tools is not None
            tool_schemas, tool_choice = denormalize_tools(
                current_prompt_version.tools, current_prompt_version.model_provider
            )
            tools = [dict(definition=schema) for schema in tool_schemas]
            # Add tool_choice back to invocation_parameters if present
            raw_invocation_parameters.update(tool_choice)

            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))

        # Update with prompt_version_id and identical content (matching all fields)
        # Only update the name (which doesn't affect prompt version content)
        new_evaluator_name = "updated-evaluator"

        # Create template_messages that match the fixture exactly
        template_messages = [
            dict(
                role="USER",
                content=[dict(text=dict(text="Test evaluator: {input}"))],
            )
        ]

        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": new_evaluator_name,
                    "description": llm_evaluator.description,  # Keep same as fixture
                    "promptVersionId": current_prompt_version_id,
                    "promptVersion": dict(
                        description=current_prompt_version.description,
                        templateFormat=current_prompt_version.template_format.value,
                        template=dict(messages=template_messages),
                        invocationParameters=raw_invocation_parameters,
                        tools=tools,
                        responseFormat=None,  # fixture has None
                        modelProvider=current_prompt_version.model_provider.value,
                        modelName=current_prompt_version.model_name,
                    ),
                    "outputConfig": dict(
                        name="correctness",
                        description="description",
                        optimizationDirection="MAXIMIZE",
                        values=[
                            dict(label="correct", score=1),
                            dict(label="incorrect", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        # Verify no new version was created
        async with db() as session:
            db_evaluator = await session.get(
                models.LLMEvaluator,
                llm_evaluator.id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert db_evaluator is not None
            # Verify prompt_id stayed the same
            assert db_evaluator.prompt_id == original_prompt_id
            # Verify prompt_version_tag points to the original version (no new version created)
            assert db_evaluator.prompt_version_tag is not None
            tag_version_id = db_evaluator.prompt_version_tag.prompt_version_id
            assert tag_version_id == current_prompt_version.id
            # Verify only one version exists (no new version created)
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(
                    models.PromptVersion.prompt_id == original_prompt_id
                )
            )
            assert len(prompt_versions.all()) == 1

    async def test_update_with_prompt_version_id_same_prompt(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
        llm_evaluator: models.LLMEvaluator,
    ) -> None:
        """Test that updating with prompt_version_id pointing to same prompt updates tag."""
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        original_prompt_id = llm_evaluator.prompt_id

        # Create a second version for the same prompt
        async with db() as session:
            # Get existing prompt
            prompt = await session.get(models.Prompt, original_prompt_id)
            assert prompt is not None

            # Create a second version
            # Use exact values that will match the test input
            second_version = models.PromptVersion(
                description="updated",
                template_type=PromptTemplateType.CHAT,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptChatTemplate(
                    type="chat",
                    messages=[
                        PromptMessage(
                            role="user",
                            content=[TextContentPart(type="text", text="Second version: {input}")],
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
                                "name": "updated-evaluator",
                                "description": "updated description",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "enum": ["correct", "incorrect"],
                                            "description": "correctness",
                                        }
                                    },
                                    "required": ["label"],
                                },
                            },
                        }
                    ],
                    ModelProvider.OPENAI,
                    tool_choice="required",
                ),
                response_format=None,
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                metadata_={},
                prompt_id=original_prompt_id,
            )
            session.add(second_version)
            await session.flush()
            second_version_id = str(GlobalID("PromptVersion", str(second_version.id)))

            dataset_evaluator = await session.scalar(
                select(models.DatasetEvaluators).where(
                    models.DatasetEvaluators.dataset_id == empty_dataset.id,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                )
            )
            assert dataset_evaluator is not None
            dataset_evaluator_id = str(GlobalID("DatasetEvaluator", str(dataset_evaluator.id)))

        # Update with prompt_version_id pointing to the second version (same prompt)
        # Use identical content so no new version is created
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "datasetId": dataset_id,
                    "name": "updated-evaluator",
                    "description": "updated description",
                    "promptVersionId": second_version_id,
                    "promptVersion": dict(
                        description="updated",
                        templateFormat="F_STRING",
                        template=dict(
                            messages=[
                                dict(
                                    role="USER",
                                    content=[dict(text=dict(text="Second version: {input}"))],
                                )
                            ]
                        ),
                        invocationParameters=dict(
                            temperature=0.0,  # Same as second_version
                            tool_choice="required",
                        ),
                        tools=[
                            dict(
                                definition=dict(
                                    type="function",
                                    function=dict(
                                        name="updated-evaluator",
                                        description="updated description",
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
                    "outputConfig": dict(
                        name="correctness",
                        description="description",
                        optimizationDirection="MAXIMIZE",
                        values=[
                            dict(label="correct", score=1),
                            dict(label="incorrect", score=0),
                        ],
                    ),
                }
            },
        )
        assert result.data and not result.errors

        # Verify evaluator still points to same prompt, and tag points to second version
        async with db() as session:
            db_evaluator = await session.get(
                models.LLMEvaluator,
                llm_evaluator.id,
                options=(selectinload(models.LLMEvaluator.prompt_version_tag),),
            )
            assert db_evaluator is not None
            # Verify prompt_id stayed the same
            assert db_evaluator.prompt_id == original_prompt_id
            # Verify prompt_version_tag points to the second version (no new version created)
            assert db_evaluator.prompt_version_tag is not None
            assert db_evaluator.prompt_version_tag.prompt_version_id == second_version.id
            assert db_evaluator.prompt_version_tag.prompt_id == original_prompt_id
            # Verify only 2 versions exist (original + second, no new one created)
            prompt_versions = await session.scalars(
                select(models.PromptVersion).where(
                    models.PromptVersion.prompt_id == original_prompt_id
                )
            )
            assert len(prompt_versions.all()) == 2


class TestCreateDatasetBuiltinEvaluatorMutation:
    _MUTATION = """
      mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
        createDatasetBuiltinEvaluator(input: $input) {
          evaluator {
            id
            name
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
            name="test-builtin-evaluator",
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetBuiltinEvaluator"]["evaluator"]
        builtin_evaluator_data = dataset_evaluator["evaluator"]
        assert dataset_evaluator["name"] == "test-builtin-evaluator"
        assert builtin_evaluator_data["kind"] == "CODE"

        dataset_evaluator_id = int(GlobalID.from_id(dataset_evaluator["id"]).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.evaluator_id == builtin_evaluator_id
            # user_id is None when authentication is disabled
            assert db_dataset_evaluator.user_id is None
            assert db_dataset_evaluator.input_mapping == {
                "literal_mapping": {},
                "path_mapping": {},
            }

        # Success: Create builtin evaluator with custom input_mapping
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=builtin_evaluator_gid,
            name="test-builtin-evaluator-2",
            inputMapping=dict(
                literalMapping={"key": "value"},
                pathMapping={"input": "context.input"},
            ),
        )
        assert result.data and not result.errors
        dataset_evaluator = result.data["createDatasetBuiltinEvaluator"]["evaluator"]
        assert dataset_evaluator["name"] == "test-builtin-evaluator-2"

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
                name="test-builtin-evaluator-3",
            )
            assert result.data and not result.errors

            async with db() as session:
                evaluators = await session.scalars(
                    select(models.DatasetEvaluators).where(
                        models.DatasetEvaluators.dataset_id == empty_dataset.id,
                        models.DatasetEvaluators.evaluator_id.isnot(None),
                    )
                )
                assert len(evaluators.all()) >= 2

        # Failure: Nonexistent dataset
        result = await self._create(
            gql_client,
            datasetId=str(GlobalID("Dataset", "999")),
            evaluatorId=builtin_evaluator_gid,
            name="test",
        )
        assert result.errors and "Dataset with id" in result.errors[0].message

        # Failure: Invalid evaluator type (not BuiltInEvaluator)
        invalid_evaluator_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=invalid_evaluator_id,
            name="test",
        )
        assert result.errors and "Invalid evaluator" in result.errors[0].message

        # Failure: Nonexistent builtin evaluator
        nonexistent_builtin_id = -999999
        nonexistent_builtin_gid = str(GlobalID("BuiltInEvaluator", str(nonexistent_builtin_id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=nonexistent_builtin_gid,
            name="test",
        )
        assert result.errors and "not found" in result.errors[0].message.lower()

        # Failure: Positive evaluator ID (builtin evaluator IDs must be negative)
        positive_id = 123
        positive_id_gid = str(GlobalID("BuiltInEvaluator", str(positive_id)))
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=positive_id_gid,
            name="test",
        )
        assert result.errors and "Invalid built-in evaluator id" in result.errors[0].message

        # Failure: Duplicate display name for same dataset
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=builtin_evaluator_gid,
            name="test-builtin-evaluator",  # Same as first one
        )
        assert result.errors and "already exists" in result.errors[0].message.lower()

    async def test_create_dataset_builtin_evaluator_duplicate_name_different_evaluators(
        self,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))

        builtin_evaluator_ids = get_builtin_evaluator_ids()
        first_builtin_evaluator_id = builtin_evaluator_ids[0]
        second_builtin_evaluator_id = builtin_evaluator_ids[1]

        first_builtin_evaluator_gid = str(
            GlobalID("BuiltInEvaluator", str(first_builtin_evaluator_id))
        )
        second_builtin_evaluator_gid = str(
            GlobalID("BuiltInEvaluator", str(second_builtin_evaluator_id))
        )

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=first_builtin_evaluator_gid,
            name="shared_name",
        )
        assert result.data and not result.errors
        assert result.data["createDatasetBuiltinEvaluator"]["evaluator"]["name"] == "shared_name"

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=second_builtin_evaluator_gid,
            name="shared_name",
        )
        assert result.errors and "already exists" in result.errors[0].message.lower()

    async def test_create_dataset_builtin_evaluator_invalid_merged_continuous_bounds(
        self,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test that continuous output config override validates merged bounds.

        When only one bound is provided in the override, it should be validated
        against the base config's bounds to ensure the merged result is valid.
        """
        from phoenix.server.api.evaluators import (
            LevenshteinDistanceEvaluator,
            _generate_builtin_evaluator_id,
        )

        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        levenshtein_id = _generate_builtin_evaluator_id(LevenshteinDistanceEvaluator.name)
        levenshtein_gid = str(GlobalID("BuiltInEvaluator", str(levenshtein_id)))

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=levenshtein_gid,
            name="test-levenshtein",
            outputConfigOverride={"continuous": {"upperBound": -1.0}},
        )
        assert result.errors
        assert "lower_bound" in result.errors[0].message.lower()
        assert "upper_bound" in result.errors[0].message.lower()

        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            evaluatorId=levenshtein_gid,
            name="test-levenshtein-2",
            outputConfigOverride={"continuous": {"lowerBound": 5.0, "upperBound": 10.0}},
        )
        assert result.data and not result.errors


class TestUpdateDatasetBuiltinEvaluatorMutation:
    _UPDATE_MUTATION = """
      mutation($input: UpdateDatasetBuiltinEvaluatorInput!) {
        updateDatasetBuiltinEvaluator(input: $input) {
          evaluator {
            id
            name
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
                  name
                }
              }
            }
            """,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": builtin_evaluator_gid,
                    "name": "original-name",
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
                    "name": "updated-name",
                }
            },
        )
        assert result.data and not result.errors

        updated_evaluator = result.data["updateDatasetBuiltinEvaluator"]["evaluator"]
        assert updated_evaluator["name"] == "updated-name"
        builtin_data = updated_evaluator["evaluator"]
        assert builtin_data["kind"] == "CODE"

        # Verify database state
        dataset_evaluator_rowid = int(GlobalID.from_id(dataset_evaluator_id).node_id)
        async with db() as session:
            db_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_rowid
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.name.root == "updated-name"
            # Input mapping should revert to default value when not provided
            assert db_dataset_evaluator.input_mapping == EvaluatorInputMappingInput().to_dict()
            # user_id is None when authentication is disabled
            assert db_dataset_evaluator.user_id is None

        # Update the evaluator with new input_mapping
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "name": "updated-name",
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
                    "name": "final-name",
                    "inputMapping": dict(
                        literalMapping={"final": "value"},
                        pathMapping={},
                    ),
                }
            },
        )
        assert result.data and not result.errors

        updated_evaluator = result.data["updateDatasetBuiltinEvaluator"]["evaluator"]
        assert updated_evaluator["name"] == "final-name"

        async with db() as session:
            db_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_rowid
            )
            assert db_dataset_evaluator is not None
            assert db_dataset_evaluator.name.root == "final-name"
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
                    "name": "test",
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
            output_config=CategoricalAnnotationConfig(
                type="CATEGORICAL",
                name="test",
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
                    name=llm_evaluator_name,
                    description="test description",
                    output_config_override=None,
                    input_mapping={},
                    project=models.Project(
                        name=f"{empty_dataset.name}/{llm_evaluator_name}",
                        description="Project for llm evaluator",
                    ),
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
                    "name": "updated-llm-name",
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

        # Failure: Duplicate display name on the same dataset
        # The unique constraint is on (dataset_id, name),
        # so any evaluator with a duplicate name on the same dataset should fail
        create_result2 = await gql_client.execute(
            """
            mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
              createDatasetBuiltinEvaluator(input: $input) {
                evaluator {
                  id
                  name
                }
              }
            }
            """,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": builtin_evaluator_gid,  # Same builtin evaluator
                    "name": "other-evaluator",
                }
            },
        )
        assert create_result2.data and not create_result2.errors

        # Try to update the first evaluator to have the same name as the second
        # (both are the same builtin_evaluator_id, so this should fail)
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "name": "other-evaluator",  # Same as second assignment
                }
            },
        )
        assert result.errors and "already exists" in result.errors[0].message.lower()

    async def test_update_dataset_builtin_evaluator_invalid_merged_continuous_bounds(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test that update mutation validates merged bounds for continuous config override."""
        from phoenix.server.api.evaluators import (
            LevenshteinDistanceEvaluator,
            _generate_builtin_evaluator_id,
        )

        dataset_id = str(GlobalID("Dataset", str(empty_dataset.id)))
        levenshtein_id = _generate_builtin_evaluator_id(LevenshteinDistanceEvaluator.name)
        levenshtein_gid = str(GlobalID("BuiltInEvaluator", str(levenshtein_id)))

        create_result = await gql_client.execute(
            """
            mutation($input: CreateDatasetBuiltinEvaluatorInput!) {
              createDatasetBuiltinEvaluator(input: $input) {
                evaluator { id }
              }
            }
            """,
            {
                "input": {
                    "datasetId": dataset_id,
                    "evaluatorId": levenshtein_gid,
                    "name": "test-levenshtein-update",
                }
            },
        )
        assert create_result.data and not create_result.errors
        dataset_evaluator_id = create_result.data["createDatasetBuiltinEvaluator"]["evaluator"][
            "id"
        ]

        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "name": "test-levenshtein-update",
                    "outputConfigOverride": {"continuous": {"upperBound": -1.0}},
                }
            },
        )
        assert result.errors
        assert "lower_bound" in result.errors[0].message.lower()
        assert "upper_bound" in result.errors[0].message.lower()

        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorId": dataset_evaluator_id,
                    "name": "test-levenshtein-update",
                    "outputConfigOverride": {"continuous": {"lowerBound": 5.0, "upperBound": 10.0}},
                }
            },
        )
        assert result.data and not result.errors


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
async def llm_evaluator(
    db: DbSessionFactory, empty_dataset: models.Dataset
) -> AsyncIterator[models.LLMEvaluator]:
    """Inserts an LLM evaluator with dataset relationship."""
    evaluator_name = IdentifierModel.model_validate(f"test-llm-evaluator-{token_hex(4)}")
    evaluator_description = "test llm evaluator"
    annotation_name = "correctness"

    # Create tools that match the evaluator's output config
    tool_schema = {
        "type": "function",
        "function": {
            "name": evaluator_name.root,
            "description": evaluator_description,
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "enum": ["correct", "incorrect"],
                        "description": annotation_name,
                    }
                },
                "required": ["label"],
            },
        },
    }
    tools = normalize_tools(
        schemas=[tool_schema],
        model_provider=ModelProvider.OPENAI,
        tool_choice="required",
    )

    prompt = models.Prompt(
        name=IdentifierModel.model_validate(f"test-prompt-{token_hex(4)}"),
        description="test prompt",
        prompt_versions=[
            models.PromptVersion(
                template_type=PromptTemplateType.CHAT,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptChatTemplate(
                    type="chat",
                    messages=[
                        PromptMessage(
                            role="user",
                            content=[TextContentPart(type="text", text="Test evaluator: {input}")],
                        )
                    ],
                ),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai",
                    openai=PromptOpenAIInvocationParametersContent(),
                ),
                tools=tools,
                response_format=None,
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                metadata_={},
            )
        ],
    )
    evaluator = models.LLMEvaluator(
        name=evaluator_name,
        description=evaluator_description,
        kind="LLM",
        output_config=CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name=annotation_name,
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
                name=evaluator_name,
                description="correctness description",
                output_config_override=None,
                input_mapping={},
                project=models.Project(
                    name=f"{empty_dataset.name}/{evaluator_name}",
                    description="Project for evaluator",
                ),
            ),
        ],
    )
    async with db() as session:
        session.add(evaluator)
        await session.flush()
        prompt_version = prompt.prompt_versions[0]
        tag_name = IdentifierModel.model_validate(f"{evaluator_name.root}-evaluator-{token_hex(4)}")
        prompt_tag = models.PromptVersionTag(
            name=tag_name,
            prompt_id=prompt.id,
            prompt_version_id=prompt_version.id,
        )
        evaluator.prompt_version_tag = prompt_tag
        session.add(evaluator)

    yield evaluator
    async with db() as session:
        await session.execute(
            sa.delete(models.LLMEvaluator).where(models.LLMEvaluator.id == evaluator.id)
        )
        await session.execute(
            sa.delete(models.PromptVersionTag).where(models.PromptVersionTag.prompt_id == prompt.id)
        )
        await session.execute(
            sa.delete(models.PromptVersion).where(models.PromptVersion.prompt_id == prompt.id)
        )
        await session.execute(sa.delete(models.Prompt).where(models.Prompt.id == prompt.id))


class TestDeleteDatasetEvaluators:
    """Tests for the delete_dataset_evaluators mutation."""

    _DELETE_MUTATION = """
      mutation($input: DeleteDatasetEvaluatorsInput!) {
        deleteDatasetEvaluators(input: $input) {
          datasetEvaluatorIds
          query { __typename }
        }
      }
    """

    async def test_delete_builtin_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test deleting a built-in evaluator removes the DatasetEvaluators row and project."""
        builtin_evaluator_ids = get_builtin_evaluator_ids()
        assert len(builtin_evaluator_ids) > 0, "No builtin evaluators available for testing"
        builtin_evaluator_id = builtin_evaluator_ids[0]

        # Create a builtin dataset evaluator
        async with db() as session:
            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=empty_dataset.id,
                evaluator_id=builtin_evaluator_id,
                name=IdentifierModel.model_validate("test-builtin-evaluator"),
                input_mapping={},
                project=models.Project(
                    name=f"{empty_dataset.name}/test-builtin-evaluator",
                    description="Project for builtin evaluator",
                ),
            )
            session.add(dataset_evaluator)
            await session.flush()
            dataset_evaluator_id = dataset_evaluator.id
            project_id = dataset_evaluator.project_id
            dataset_evaluator_gid = str(GlobalID("DatasetEvaluator", str(dataset_evaluator_id)))

        # Delete the evaluator
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": [dataset_evaluator_gid]}},
        )

        # Verify success
        assert not result.errors
        assert result.data is not None
        assert (
            dataset_evaluator_gid in result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"]
        )

        # Verify the DatasetEvaluators row and associated project are deleted
        async with db() as session:
            deleted_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_id)
            assert deleted_evaluator is None

            deleted_project = await session.get(models.Project, project_id)
            assert deleted_project is None

    async def test_delete_llm_evaluator(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test deleting an LLM evaluator cascades to delete the Evaluator record."""
        evaluator_name = IdentifierModel.model_validate(f"test-llm-evaluator-delete-{token_hex(4)}")

        # Create an LLM evaluator with dataset relationship
        async with db() as session:
            prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"test-prompt-{token_hex(4)}"),
                description="test prompt",
                prompt_versions=[
                    models.PromptVersion(
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[TextContentPart(type="text", text="Test: {{input}}")],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(),
                        ),
                        tools=None,
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description="test llm evaluator for deletion",
                kind="LLM",
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="correctness",
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
                        name=evaluator_name,
                        description="test description",
                        output_config_override=None,
                        input_mapping={},
                        project=models.Project(
                            name=f"{empty_dataset.name}/{evaluator_name}",
                            description="Project for llm evaluator deletion",
                        ),
                    )
                ],
            )
            session.add(llm_evaluator)
            await session.flush()
            evaluator_id = llm_evaluator.id
            dataset_evaluator_id = llm_evaluator.dataset_evaluators[0].id
            project_id = llm_evaluator.dataset_evaluators[0].project_id
            dataset_evaluator_gid = str(GlobalID("DatasetEvaluator", str(dataset_evaluator_id)))

        # Delete the dataset evaluator
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": [dataset_evaluator_gid]}},
        )

        # Verify success
        assert not result.errors
        assert result.data is not None
        assert (
            dataset_evaluator_gid in result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"]
        )

        # Verify the DatasetEvaluators, Evaluator, and Project rows are deleted
        async with db() as session:
            deleted_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_id
            )
            assert deleted_dataset_evaluator is None

            deleted_evaluator = await session.get(models.Evaluator, evaluator_id)
            assert deleted_evaluator is None

            deleted_project = await session.get(models.Project, project_id)
            assert deleted_project is None

    async def test_delete_multiple_evaluators_mixed(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test deleting a mix of built-in and LLM evaluators in a single call."""
        builtin_evaluator_ids = get_builtin_evaluator_ids()
        assert len(builtin_evaluator_ids) > 0, "No builtin evaluators available for testing"
        builtin_evaluator_id = builtin_evaluator_ids[0]

        # Create a builtin dataset evaluator
        async with db() as session:
            builtin_dataset_evaluator = models.DatasetEvaluators(
                dataset_id=empty_dataset.id,
                evaluator_id=builtin_evaluator_id,
                name=IdentifierModel.model_validate("test-builtin-for-batch-delete"),
                input_mapping={},
                project=models.Project(
                    name=f"{empty_dataset.name}/test-builtin-for-batch-delete",
                    description="Project for builtin batch delete",
                ),
            )
            session.add(builtin_dataset_evaluator)
            await session.flush()
            builtin_de_id = builtin_dataset_evaluator.id
            builtin_project_id = builtin_dataset_evaluator.project_id
            builtin_de_gid = str(GlobalID("DatasetEvaluator", str(builtin_de_id)))

        # Create an LLM evaluator
        evaluator_name = IdentifierModel.model_validate(f"test-llm-batch-delete-{token_hex(4)}")
        async with db() as session:
            prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"test-prompt-batch-{token_hex(4)}"),
                description="test prompt",
                prompt_versions=[
                    models.PromptVersion(
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[TextContentPart(type="text", text="Test: {{input}}")],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(),
                        ),
                        tools=None,
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description="test llm evaluator for batch deletion",
                kind="LLM",
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="correctness",
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
                        name=evaluator_name,
                        description="test description",
                        output_config_override=None,
                        input_mapping={},
                        project=models.Project(
                            name=f"{empty_dataset.name}/{evaluator_name}",
                            description="Project for batch delete llm evaluator",
                        ),
                    )
                ],
            )
            session.add(llm_evaluator)
            await session.flush()
            llm_evaluator_id = llm_evaluator.id
            llm_de_id = llm_evaluator.dataset_evaluators[0].id
            llm_project_id = llm_evaluator.dataset_evaluators[0].project_id
            llm_de_gid = str(GlobalID("DatasetEvaluator", str(llm_de_id)))

        # Delete both evaluators in one call
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": [builtin_de_gid, llm_de_gid]}},
        )

        # Verify success
        assert not result.errors
        assert result.data is not None
        deleted_ids = result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"]
        assert builtin_de_gid in deleted_ids
        assert llm_de_gid in deleted_ids

        # Verify all rows including projects are deleted
        async with db() as session:
            # Builtin dataset evaluator should be deleted
            deleted_builtin_de = await session.get(models.DatasetEvaluators, builtin_de_id)
            assert deleted_builtin_de is None

            # Builtin project should be deleted
            deleted_builtin_project = await session.get(models.Project, builtin_project_id)
            assert deleted_builtin_project is None

            # LLM dataset evaluator and its parent evaluator should be deleted
            deleted_llm_de = await session.get(models.DatasetEvaluators, llm_de_id)
            assert deleted_llm_de is None

            deleted_llm_evaluator = await session.get(models.Evaluator, llm_evaluator_id)
            assert deleted_llm_evaluator is None

            # LLM project should be deleted
            deleted_llm_project = await session.get(models.Project, llm_project_id)
            assert deleted_llm_project is None

    async def test_delete_nonexistent_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test deleting a nonexistent evaluator returns empty result."""
        nonexistent_gid = str(GlobalID("DatasetEvaluator", "999999"))

        # Attempt to delete nonexistent evaluator
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": [nonexistent_gid]}},
        )

        # Should succeed but return empty list since no evaluator was found
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"] == []

    async def test_delete_invalid_id_type(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test deleting with invalid ID type returns error."""
        invalid_gid = str(GlobalID("Dataset", "1"))  # Wrong type

        # Attempt to delete with invalid type
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": [invalid_gid]}},
        )

        # Should return error
        assert result.errors is not None
        assert "Invalid dataset evaluator id" in result.errors[0].message

    async def test_delete_empty_list(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test deleting with empty list returns empty result."""
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {"input": {"datasetEvaluatorIds": []}},
        )

        # Should succeed with empty result
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"] == []

    async def test_delete_llm_evaluator_with_prompt_deletion(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test deleting an LLM evaluator with deleteAssociatedPrompt=True also deletes the prompt."""
        evaluator_name = IdentifierModel.model_validate(f"test-llm-with-prompt-del-{token_hex(4)}")

        # Create an LLM evaluator with prompt
        async with db() as session:
            prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"test-prompt-to-delete-{token_hex(4)}"),
                description="test prompt to be deleted",
                prompt_versions=[
                    models.PromptVersion(
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[TextContentPart(type="text", text="Test: {{input}}")],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(),
                        ),
                        tools=None,
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description="test llm evaluator for prompt deletion",
                kind="LLM",
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="correctness",
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
                        name=evaluator_name,
                        description="test description",
                        output_config_override=None,
                        input_mapping={},
                        project=models.Project(
                            name=f"{empty_dataset.name}/{evaluator_name}",
                            description="Project for llm evaluator with prompt deletion",
                        ),
                    )
                ],
            )
            session.add(llm_evaluator)
            await session.flush()
            prompt_id = prompt.id
            evaluator_id = llm_evaluator.id
            dataset_evaluator_id = llm_evaluator.dataset_evaluators[0].id
            project_id = llm_evaluator.dataset_evaluators[0].project_id
            dataset_evaluator_gid = str(GlobalID("DatasetEvaluator", str(dataset_evaluator_id)))

        # Delete with deleteAssociatedPrompt=True (default)
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorIds": [dataset_evaluator_gid],
                    "deleteAssociatedPrompt": True,
                }
            },
        )

        # Verify success
        assert not result.errors
        assert result.data is not None
        assert (
            dataset_evaluator_gid in result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"]
        )

        # Verify the evaluator, prompt, and project are all deleted
        async with db() as session:
            deleted_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_id
            )
            assert deleted_dataset_evaluator is None

            deleted_evaluator = await session.get(models.Evaluator, evaluator_id)
            assert deleted_evaluator is None

            deleted_prompt = await session.get(models.Prompt, prompt_id)
            assert deleted_prompt is None

            deleted_project = await session.get(models.Project, project_id)
            assert deleted_project is None

    async def test_delete_llm_evaluator_without_prompt_deletion(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        empty_dataset: models.Dataset,
    ) -> None:
        """Test deleting an LLM evaluator with deleteAssociatedPrompt=False preserves the prompt."""
        evaluator_name = IdentifierModel.model_validate(f"test-llm-keep-prompt-{token_hex(4)}")

        # Create an LLM evaluator with prompt
        async with db() as session:
            prompt = models.Prompt(
                name=IdentifierModel.model_validate(f"test-prompt-to-keep-{token_hex(4)}"),
                description="test prompt to be kept",
                prompt_versions=[
                    models.PromptVersion(
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template=PromptChatTemplate(
                            type="chat",
                            messages=[
                                PromptMessage(
                                    role="user",
                                    content=[TextContentPart(type="text", text="Test: {{input}}")],
                                )
                            ],
                        ),
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(),
                        ),
                        tools=None,
                        response_format=None,
                        model_provider=ModelProvider.OPENAI,
                        model_name="gpt-4",
                        metadata_={},
                    )
                ],
            )
            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description="test llm evaluator to keep prompt",
                kind="LLM",
                output_config=CategoricalAnnotationConfig(
                    type="CATEGORICAL",
                    name="correctness",
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
                        name=evaluator_name,
                        description="test description",
                        output_config_override=None,
                        input_mapping={},
                        project=models.Project(
                            name=f"{empty_dataset.name}/{evaluator_name}",
                            description="Project for llm evaluator without prompt deletion",
                        ),
                    )
                ],
            )
            session.add(llm_evaluator)
            await session.flush()
            prompt_id = prompt.id
            evaluator_id = llm_evaluator.id
            dataset_evaluator_id = llm_evaluator.dataset_evaluators[0].id
            project_id = llm_evaluator.dataset_evaluators[0].project_id
            dataset_evaluator_gid = str(GlobalID("DatasetEvaluator", str(dataset_evaluator_id)))

        # Delete with deleteAssociatedPrompt=False
        result = await gql_client.execute(
            self._DELETE_MUTATION,
            {
                "input": {
                    "datasetEvaluatorIds": [dataset_evaluator_gid],
                    "deleteAssociatedPrompt": False,
                }
            },
        )

        # Verify success
        assert not result.errors
        assert result.data is not None
        assert (
            dataset_evaluator_gid in result.data["deleteDatasetEvaluators"]["datasetEvaluatorIds"]
        )

        # Verify the evaluator and project are deleted but prompt is preserved
        async with db() as session:
            deleted_dataset_evaluator = await session.get(
                models.DatasetEvaluators, dataset_evaluator_id
            )
            assert deleted_dataset_evaluator is None

            deleted_evaluator = await session.get(models.Evaluator, evaluator_id)
            assert deleted_evaluator is None

            # Project should be deleted
            deleted_project = await session.get(models.Project, project_id)
            assert deleted_project is None

            # Prompt should still exist
            kept_prompt = await session.get(models.Prompt, prompt_id)
            assert kept_prompt is not None

        # Clean up the prompt
        async with db() as session:
            await session.execute(sa.delete(models.Prompt).where(models.Prompt.id == prompt_id))
