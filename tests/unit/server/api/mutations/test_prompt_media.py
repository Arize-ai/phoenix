from __future__ import annotations

import base64
from typing import Any

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.media import MediaContent
from phoenix.db.types.prompts import (
    PromptChatTemplate,
)
from phoenix.db.types.media_parts import (
    ImageContentPart,
    media_variable_names,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_DIGEST = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
_HOSTED_URL = f"phoenix://media/{_DIGEST}"
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
_INLINE_URL = f"data:image/png;base64,{base64.b64encode(_PNG_BYTES).decode()}"


def _create_input(content: list[dict[str, Any]], role: str = "USER") -> dict[str, Any]:
    return {
        "input": {
            "name": "media-prompt",
            "description": "a prompt with media",
            "promptVersion": {
                "description": "v1",
                "templateFormat": "MUSTACHE",
                "template": {"messages": [{"role": role, "content": content}]},
                "invocationParameters": {"google": {"temperature": 0.2}},
                "modelProvider": "GOOGLE",
                "modelName": "gemini-2.5-flash",
            },
        }
    }


class TestPromptMediaMutations:
    _MUTATION = """
      mutation CreateChatPromptMutation($input: CreateChatPromptInput!) {
        createChatPrompt(input: $input) {
          id
          promptVersions {
            edges {
              promptVersion: node {
                id
                template {
                  ... on PromptChatTemplate {
                    messages {
                      role
                      content {
                        __typename
                        ... on TextContentPart {
                          text { text }
                        }
                        ... on ImageContentPart {
                          image {
                            __typename
                            ... on ImageContentValue { url mediaType }
                            ... on ImageVariableValue { variable }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    """

    async def test_creates_prompt_with_text_and_hosted_image(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input(
                [
                    {"text": {"text": "what is in {{subject}}?"}},
                    {"image": {"url": _HOSTED_URL, "mediaType": "image/png"}},
                ]
            ),
        )
        assert not result.errors
        assert result.data is not None

        prompt_version = result.data["createChatPrompt"]["promptVersions"]["edges"][0][
            "promptVersion"
        ]
        content = prompt_version["template"]["messages"][0]["content"]
        assert [part["__typename"] for part in content] == [
            "TextContentPart",
            "ImageContentPart",
        ]
        assert content[1]["image"] == {
            "__typename": "ImageContentValue",
            "url": _HOSTED_URL,
            "mediaType": "image/png",
        }

        async with db() as session:
            template = await session.scalar(select(models.PromptVersion.template))
        assert isinstance(template, PromptChatTemplate)
        stored_content = template.messages[0].content
        assert not isinstance(stored_content, str)
        stored_part = stored_content[1]
        assert isinstance(stored_part, ImageContentPart)
        assert isinstance(stored_part.image, MediaContent)
        assert stored_part.image.url == _HOSTED_URL
        assert stored_part.image.media_type == "image/png"

    async def test_creates_prompt_with_inline_image(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"image": {"url": _INLINE_URL, "mediaType": "image/png"}}]),
        )
        assert not result.errors
        assert result.data is not None
        content = result.data["createChatPrompt"]["promptVersions"]["edges"][0]["promptVersion"][
            "template"
        ]["messages"][0]["content"]
        assert content[0]["image"]["url"] == _INLINE_URL

    @pytest.mark.parametrize(
        "role",
        [
            pytest.param("SYSTEM", id="system"),
            pytest.param("AI", id="ai"),
            pytest.param("TOOL", id="tool"),
        ],
    )
    async def test_rejects_image_outside_user_message(
        self,
        gql_client: AsyncGraphQLClient,
        role: str,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input(
                [{"image": {"url": _HOSTED_URL, "mediaType": "image/png"}}],
                role=role,
            ),
        )
        assert result.errors
        assert "only supported on 'user' messages" in str(result.errors)

    async def test_rejects_unsupported_media_type(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"image": {"url": _HOSTED_URL, "mediaType": "image/svg+xml"}}]),
        )
        assert result.errors
        assert "unsupported image media type" in str(result.errors)

    @pytest.mark.parametrize(
        "url",
        [
            pytest.param("https://example.com/cat.png", id="https"),
            pytest.param("file:///etc/passwd", id="file"),
        ],
    )
    async def test_rejects_external_url(
        self,
        gql_client: AsyncGraphQLClient,
        url: str,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"image": {"url": url, "mediaType": "image/png"}}]),
        )
        assert result.errors
        assert "unsupported media URL scheme" in str(result.errors)

    async def test_rejects_malformed_hosted_reference(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"image": {"url": "phoenix://media/nope", "mediaType": "image/png"}}]),
        )
        assert result.errors
        assert "malformed Phoenix media URL" in str(result.errors)

    async def test_rejects_media_type_conflicting_with_data_url(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"image": {"url": _INLINE_URL, "mediaType": "image/gif"}}]),
        )
        assert result.errors
        assert "does not match the type declared" in str(result.errors)

    async def test_rejects_content_part_with_two_variants_set(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input(
                [
                    {
                        "text": {"text": "hello"},
                        "image": {"url": _HOSTED_URL, "mediaType": "image/png"},
                    }
                ]
            ),
        )
        assert result.errors

    async def test_creates_prompt_with_an_image_variable(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input(
                [
                    {"text": {"text": "Describe this, focusing on {{aspect}}."}},
                    {"imageVariable": {"variable": "question_image"}},
                ]
            ),
        )
        assert not result.errors
        assert result.data is not None

        content = result.data["createChatPrompt"]["promptVersions"]["edges"][0]["promptVersion"][
            "template"
        ]["messages"][0]["content"]
        assert content[1]["image"] == {
            "__typename": "ImageVariableValue",
            "variable": "question_image",
        }

        async with db() as session:
            template = await session.scalar(select(models.PromptVersion.template))
        assert isinstance(template, PromptChatTemplate)
        assert media_variable_names(template) == ["question_image"]

    async def test_rejects_an_empty_variable_name(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"imageVariable": {"variable": "  "}}]),
        )
        assert result.errors
        assert "cannot be empty" in str(result.errors)

    async def test_rejects_an_image_variable_outside_a_user_message(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._MUTATION,
            _create_input([{"imageVariable": {"variable": "img"}}], role="SYSTEM"),
        )
        assert result.errors
        assert "only supported on 'user' messages" in str(result.errors)
