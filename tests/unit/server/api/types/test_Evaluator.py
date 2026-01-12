from secrets import token_hex
from typing import Any, AsyncIterator

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.types.Evaluator import LLMEvaluator
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


def _create_prompt_version(prompt_id: int, template: str, model: str) -> models.PromptVersion:
    """Helper to create a prompt version with consistent defaults."""
    return models.PromptVersion(
        prompt_id=prompt_id,
        template_type=PromptTemplateType.STRING,
        template_format=PromptTemplateFormat.F_STRING,
        template=PromptStringTemplate(type="string", template=template),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        ),
        tools=None,
        response_format=None,
        model_provider=ModelProvider.OPENAI,
        model_name=model,
        metadata_={},
    )


class TestEvaluatorFields:
    """Tests for evaluator polymorphism and field resolution."""

    @pytest.fixture
    async def _test_data(self, db: DbSessionFactory) -> AsyncIterator[dict[str, Any]]:
        """Create test data: prompt with 2 versions, 1 tag pointing to v1, and 2 evaluators."""
        async with db() as session:
            prompt = models.Prompt(name=Identifier(token_hex(4)))
            session.add(prompt)
            await session.flush()

            v1, v2 = (
                _create_prompt_version(prompt.id, "V1: {input}", "gpt-4"),
                _create_prompt_version(prompt.id, "V2: {input}", "gpt-3.5-turbo"),
            )
            session.add_all([v1, v2])
            await session.flush()

            tag = models.PromptVersionTag(
                name=Identifier(token_hex(4)), prompt_id=prompt.id, prompt_version_id=v1.id
            )
            session.add(tag)
            await session.flush()

            untagged = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                metadata_={"key": "value", "count": 42},
            )
            tagged = models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                prompt_version_tag_id=tag.id,
                metadata_=None,
            )
            session.add_all([untagged, tagged])

        ids = {
            "prompt": prompt.id,
            "v1": v1.id,
            "v2": v2.id,
            "tag": tag.id,
            "untagged": untagged.id,
            "tagged": tagged.id,
        }
        yield ids

    async def test_llm_evaluator_fields(
        self, _test_data: dict[str, Any], gql_client: AsyncGraphQLClient
    ) -> None:
        """Test LLMEvaluator interface fields, relationships, and version resolution logic."""
        # Test untagged evaluator: interface fields, promptVersion returns latest, and metadata is non-null
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator { id name kind metadata createdAt updatedAt }
                    ... on LLMEvaluator { prompt { id } promptVersion { id } }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["untagged"])))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["kind"] == "LLM"
        assert node["createdAt"] and node["updatedAt"]
        assert node["metadata"] == {"key": "value", "count": 42}
        assert node["prompt"]["id"] == str(GlobalID("Prompt", str(_test_data["prompt"])))
        assert node["promptVersion"]["id"] == str(GlobalID("PromptVersion", str(_test_data["v2"])))

        # Test tagged evaluator: promptVersionTag exists, promptVersion returns tagged version, and metadata is null
        resp = await gql_client.execute(
            """query ($id: ID!) {
                node(id: $id) {
                    ... on Evaluator { metadata }
                    ... on LLMEvaluator {
                        promptVersionTag { id }
                        promptVersion { id }
                    }
                }
            }""",
            variables={"id": str(GlobalID(LLMEvaluator.__name__, str(_test_data["tagged"])))},
        )
        assert not resp.errors and resp.data
        node = resp.data["node"]
        assert node["metadata"] == {}
        assert node["promptVersionTag"]["id"] == str(
            GlobalID("PromptVersionTag", str(_test_data["tag"]))
        )
        assert node["promptVersion"]["id"] == str(GlobalID("PromptVersion", str(_test_data["v1"])))
