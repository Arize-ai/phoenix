from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestDatasetLLMEvaluatorMutations:
    _MUTATION = """
      mutation($input: CreateDatasetLLMEvaluatorInput!) {
        createDatasetLlmEvaluator(input: $input) {
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
                invocationParameters=dict(temperature=0.0),
                modelProvider="OPENAI",
                modelName="gpt-4",
            ),
        )
        assert result.data and not result.errors
        evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
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

        # Success: Anthropic provider
        result = await self._create(
            gql_client,
            datasetId=dataset_id,
            name="anthropic",
            description="anthropic",
            promptVersion=dict(
                description="anthropic version",
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content=[dict(text=dict(text="Rate"))])]),
                invocationParameters=dict(temperature=0.7, max_tokens=50),
                modelProvider="ANTHROPIC",
                modelName="claude-3-opus-20240229",
            ),
        )
        assert result.data and not result.errors
        evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
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
                invocationParameters=dict(temperature=0.5, max_tokens=100),
                modelProvider="ANTHROPIC",
                modelName="claude-3-opus-20240229",
            ),
        )
        assert result.data and not result.errors
        evaluator = result.data["createDatasetLlmEvaluator"]["evaluator"]
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
            promptVersion=dict(
                templateFormat="MUSTACHE",
                template=dict(messages=[dict(role="USER", content=[dict(text=dict(text="Test"))])]),
                invocationParameters=dict(temperature=0.5),
                modelProvider="OPENAI",
                modelName="gpt-4",
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
        )
        assert result.errors


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
