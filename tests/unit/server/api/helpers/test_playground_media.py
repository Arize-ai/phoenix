from __future__ import annotations

import base64
import hashlib
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Callable

import pytest
from openinference.semconv.trace import SpanAttributes
from pydantic import ValidationError

from phoenix.db import models
from phoenix.db.types.media import MediaContent, MediaVariable, hosted_media_url
from phoenix.db.types.model_provider import LLMClientFactory
from phoenix.db.types.prompts import (
    FileContentPart,
    ImageContentPart,
    PromptChatTemplate,
    PromptMessage,
    PromptTemplateFormat,
    TextContentPart,
    media_variable_names,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.media import MediaResolutionError
from phoenix.server.api.helpers.message_helpers import (
    PlaygroundMessage,
    formatted_messages,
    message_media,
    message_text,
    prompt_chat_template_to_playground_messages,
    reject_media,
    resolve_message_media,
)
from phoenix.server.api.helpers.playground_clients import (
    AnthropicStreamingClient,
    BedrockStreamingClient,
    GoogleStreamingClient,
    llm_input_messages,
)
from phoenix.server.api.helpers.playground_media import google_parts
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.types import DbSessionFactory

_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
_PNG_DIGEST = hashlib.sha256(_PNG_BYTES).hexdigest()
_PNG_URL = hosted_media_url(_PNG_DIGEST)
_GIF_BYTES = b"GIF89a" + b"\x00" * 10
_GIF_DIGEST = hashlib.sha256(_GIF_BYTES).hexdigest()


def _image_part(url: str = _PNG_URL, media_type: str = "image/png") -> ImageContentPart:
    return ImageContentPart(
        type="image",
        image=MediaContent(url=url, media_type=media_type),
    )


def _template(*, url: str = _PNG_URL, media_type: str = "image/png") -> PromptChatTemplate:
    return PromptChatTemplate(
        type="chat",
        messages=[
            PromptMessage(
                role="user",
                content=[
                    TextContentPart(type="text", text="before"),
                    _image_part(url=url, media_type=media_type),
                    TextContentPart(type="text", text="after"),
                ],
            )
        ],
    )


@pytest.fixture
async def stored_png(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(
            models.MediaFile(
                sha256=_PNG_DIGEST,
                media_type="image/png",
                size_bytes=len(_PNG_BYTES),
                content=_PNG_BYTES,
            )
        )


def _dummy_factory(name: str) -> Any:
    @asynccontextmanager
    async def create_client() -> AsyncIterator[Any]:
        yield None

    return LLMClientFactory(create_client, (name, "test"))


def _google_client() -> Any:
    return GoogleStreamingClient(
        client_factory=_dummy_factory("google"),
        model_name="gemini-2.5-flash",
        provider="google",
    )


class TestTemplateToBlocks:
    def test_preserves_the_order_of_text_and_media(self) -> None:
        (message,) = prompt_chat_template_to_playground_messages(_template())
        content = message["content"]
        assert not isinstance(content, str)
        assert [block["type"] for block in content] == ["text", "media", "text"]
        assert [block.get("kind") for block in content] == [None, "image", None]
        assert message_text(message) == "before\nafter"
        assert [block["url"] for block in message_media(message)] == [_PNG_URL]

    def test_media_blocks_start_unresolved(self) -> None:
        (message,) = prompt_chat_template_to_playground_messages(_template())
        assert message_media(message)[0].get("data") is None


class TestFormattingMediaReferences:
    def test_formats_text_and_leaves_media_references_alone(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="describe {{label}}"),
                        _image_part(),
                    ],
                )
            ],
        )
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(template),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={"label": "the receipt"},
        )
        assert message_text(messages[0]) == "describe the receipt"
        assert message_media(messages[0])[0]["url"] == _PNG_URL

    def test_leaves_media_unresolved(self) -> None:
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(_template()),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={},
        )
        assert "data" not in message_media(messages[0])[0]

    def test_a_template_placeholder_is_not_a_valid_media_reference(self) -> None:
        """
        Media in a stored template is concrete. Selecting media per-run would need
        a mechanism that survives authoring-time reference validation.
        """
        with pytest.raises(ValidationError, match="malformed Phoenix media URL"):
            _image_part(url="phoenix://media/{{digest}}")


class TestResolveMessageMedia:
    async def test_attaches_bytes_and_authoritative_media_type(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(_template(media_type="image/webp"))
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        block = message_media(resolved[0])[0]
        assert block["data"] == _PNG_BYTES
        assert block["media_type"] == "image/png"

    async def test_preserves_block_order_and_text(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        content = resolved[0]["content"]
        assert not isinstance(content, str)
        assert [block["type"] for block in content] == ["text", "media", "text"]
        assert [block.get("kind") for block in content] == [None, "image", None]

    async def test_passes_through_messages_without_media(self, db: DbSessionFactory) -> None:
        messages = prompt_chat_template_to_playground_messages(
            PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(role="user", content=[TextContentPart(type="text", text="hi")])
                ],
            )
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        assert message_text(resolved[0]) == "hi"

    async def test_survives_the_full_format_then_resolve_pipeline(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="describe {{label}}"),
                        _image_part(),
                    ],
                )
            ],
        )
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(template),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={"label": "this"},
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        assert message_text(resolved[0]) == "describe this"
        assert message_media(resolved[0])[0]["data"] == _PNG_BYTES


class TestGoogleParts:
    async def test_builds_ordered_parts_with_inline_data(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        parts = google_parts(resolved[0])
        assert parts == [
            {"text": "before"},
            {"inline_data": {"mime_type": "image/png", "data": _PNG_BYTES}},
            {"text": "after"},
        ]

    async def test_build_google_messages_includes_media(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        contents, system_prompt = _google_client()._build_google_messages(resolved)
        assert system_prompt == ""
        assert contents[0]["role"] == "user"
        assert contents[0]["parts"][1] == {
            "inline_data": {"mime_type": "image/png", "data": _PNG_BYTES}
        }

    def test_rejects_unresolved_media(self) -> None:
        messages = prompt_chat_template_to_playground_messages(_template())
        with pytest.raises(BadRequest, match="not resolved"):
            google_parts(messages[0])

    async def test_rejects_media_types_google_does_not_accept(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            session.add(
                models.MediaFile(
                    sha256=_GIF_DIGEST,
                    media_type="image/gif",
                    size_bytes=len(_GIF_BYTES),
                    content=_GIF_BYTES,
                )
            )
        messages = prompt_chat_template_to_playground_messages(
            _template(url=hosted_media_url(_GIF_DIGEST), media_type="image/gif")
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        with pytest.raises(BadRequest, match="does not accept image/gif"):
            google_parts(resolved[0])

    async def test_parts_validate_against_the_google_sdk(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        """
        The parts are hand-built dicts, so pin them against the real SDK model:
        a change to how google-genai names or types a part should fail here rather
        than at request time.
        """
        from google.genai import types

        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        parts = google_parts(resolved[0])

        content = types.Content.model_validate({"role": "user", "parts": parts})
        assert content.parts is not None
        assert [part.text for part in content.parts] == ["before", None, "after"]
        inline_data = content.parts[1].inline_data
        assert inline_data is not None
        assert inline_data.mime_type == "image/png"
        assert inline_data.data == _PNG_BYTES
        # The SDK base64-encodes the bytes on the way out, so Phoenix must not.
        dumped = content.model_dump(mode="json", exclude_none=True)
        assert isinstance(dumped["parts"][1]["inline_data"]["data"], str)

    def test_never_returns_an_empty_part_list(self) -> None:
        message = PlaygroundMessage(role=ChatCompletionMessageRole.USER, content="")
        assert google_parts(message) == [{"text": ""}]


class TestProvidersWithoutMediaSupport:
    def test_reject_media_names_the_provider(self) -> None:
        (message,) = prompt_chat_template_to_playground_messages(_template())
        with pytest.raises(BadRequest, match="Anthropic does not support image content"):
            reject_media([message], provider="Anthropic")

    def test_reject_media_allows_text_only_messages(self) -> None:
        messages = prompt_chat_template_to_playground_messages(
            PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(role="user", content=[TextContentPart(type="text", text="hi")])
                ],
            )
        )
        reject_media(messages, provider="Anthropic")

    def test_media_on_a_non_user_turn_is_rejected(self) -> None:
        """
        Only user turns may carry media, enforced when a prompt version is written.
        Each provider still refuses loudly rather than dropping an image that
        reached it on another role.
        """
        (message,) = prompt_chat_template_to_playground_messages(_template())
        smuggled = {**message, "role": ChatCompletionMessageRole.AI}
        builders: tuple[Callable[[], Any], ...] = (
            lambda: _anthropic_client()._build_anthropic_messages([smuggled]),
            lambda: _bedrock_client()._build_converse_messages([smuggled]),
            lambda: _openai_client()._to_openai_chat_completion_message_param(smuggled),
            lambda: _responses_client()._to_openai_response_input_item_param([smuggled]),
        )
        for build in builders:
            with pytest.raises(BadRequest, match="does not support image content"):
                build()


class TestSpanAttributes:
    async def test_records_the_reference_not_the_bytes(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        attributes = dict(llm_input_messages(resolved))

        flattened = "".join(str(value) for value in attributes.values())
        assert _PNG_URL in flattened
        assert base64.b64encode(_PNG_BYTES).decode() not in flattened

        image_url_keys = [key for key in attributes if key.endswith("image.url")]
        assert image_url_keys
        assert attributes[image_url_keys[0]] == _PNG_URL

    async def test_records_text_inside_contents_and_not_alongside_it(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        """
        The trace UI renders `message.content` and `message_contents` both, so a
        message with media must set only the latter or its text renders twice.
        """
        messages = prompt_chat_template_to_playground_messages(_template())
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        attributes = dict(llm_input_messages(resolved))

        assert not [key for key in attributes if key.endswith("message.content")]
        texts = [value for key, value in attributes.items() if key.endswith("message_content.text")]
        assert texts == ["before", "after"]

    async def test_text_only_messages_still_use_message_content(
        self,
        db: DbSessionFactory,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(
            PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(
                        role="user", content=[TextContentPart(type="text", text="just text")]
                    )
                ],
            )
        )
        attributes = dict(llm_input_messages(messages))
        content_keys = [
            key
            for key in attributes
            if key.startswith(SpanAttributes.LLM_INPUT_MESSAGES) and key.endswith("message.content")
        ]
        assert content_keys
        assert attributes[content_keys[0]] == "just text"
        assert not [key for key in attributes if "message_content" in key]


def _variable_template(name: str = "question_image") -> PromptChatTemplate:
    return PromptChatTemplate(
        type="chat",
        messages=[
            PromptMessage(
                role="user",
                content=[
                    TextContentPart(type="text", text="describe {{aspect}}"),
                    ImageContentPart(type="image", image=MediaVariable(variable=name)),
                ],
            )
        ],
    )


class TestMediaVariables:
    def test_a_variable_block_starts_without_a_reference(self) -> None:
        (message,) = prompt_chat_template_to_playground_messages(_variable_template())
        (block,) = message_media(message)
        assert block["variable"] == "question_image"
        assert "url" not in block

    def test_formatting_substitutes_the_supplied_reference(self) -> None:
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(_variable_template()),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={"aspect": "colour", "question_image": _PNG_URL},
        )
        assert message_text(messages[0]) == "describe colour"
        block = message_media(messages[0])[0]
        assert block["url"] == _PNG_URL
        assert block["variable"] == "question_image"

    def test_formatting_reports_a_missing_image(self) -> None:
        with pytest.raises(BadRequest, match="No image was supplied for 'question_image'"):
            formatted_messages(
                messages=prompt_chat_template_to_playground_messages(_variable_template()),
                template_format=PromptTemplateFormat.MUSTACHE,
                template_variables={"aspect": "colour"},
            )

    def test_formatting_reports_a_blank_image_value(self) -> None:
        with pytest.raises(BadRequest, match="is not an image reference"):
            formatted_messages(
                messages=prompt_chat_template_to_playground_messages(_variable_template()),
                template_format=PromptTemplateFormat.MUSTACHE,
                template_variables={"aspect": "c", "question_image": "   "},
            )

    async def test_resolves_the_substituted_reference_to_bytes(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(_variable_template()),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={"aspect": "colour", "question_image": _PNG_URL},
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        block = message_media(resolved[0])[0]
        assert block["data"] == _PNG_BYTES
        assert block["media_type"] == "image/png"

    async def test_resolving_before_formatting_fails_loudly(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        """Skipping substitution must not quietly send a prompt with no image."""
        messages = prompt_chat_template_to_playground_messages(_variable_template())
        async with db() as session:
            with pytest.raises(MediaResolutionError, match="No image reference was substituted"):
                await resolve_message_media(session, messages)

    async def test_a_variable_image_reaches_google_as_inline_data(
        self,
        db: DbSessionFactory,
        stored_png: None,
    ) -> None:
        messages = formatted_messages(
            messages=prompt_chat_template_to_playground_messages(_variable_template()),
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables={"aspect": "colour", "question_image": _PNG_URL},
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        parts = google_parts(resolved[0])
        assert parts == [
            {"text": "describe colour"},
            {"inline_data": {"mime_type": "image/png", "data": _PNG_BYTES}},
        ]


def _openai_client() -> Any:
    from phoenix.server.api.helpers.playground_clients import OpenAIStreamingClient

    return OpenAIStreamingClient(
        client_factory=_dummy_factory("openai"),
        model_name="gpt-4o",
        provider="openai",
    )


def _responses_client() -> Any:
    from phoenix.server.api.helpers.playground_clients import (
        OpenAIResponsesAPIStreamingClient,
    )

    return OpenAIResponsesAPIStreamingClient(
        client_factory=_dummy_factory("openai"),
        model_name="gpt-4o",
        provider="openai",
    )


def _anthropic_client() -> Any:
    return AnthropicStreamingClient(
        client_factory=_dummy_factory("anthropic"),
        model_name="claude-3-5-sonnet-latest",
        provider="anthropic",
    )


def _bedrock_client() -> Any:
    return BedrockStreamingClient(
        client_factory=_dummy_factory("aws"),
        model_name="anthropic.claude-3-5-sonnet-20240620-v1:0",
        provider="aws",
    )


@pytest.fixture
async def resolved_messages(db: DbSessionFactory, stored_png: None) -> Any:
    """A user message with text, an image, and more text — already resolved."""
    async with db() as session:
        return await resolve_message_media(
            session, prompt_chat_template_to_playground_messages(_template())
        )


_EXPECTED_DATA_URL = f"data:image/png;base64,{base64.b64encode(_PNG_BYTES).decode()}"


class TestOpenAIImages:
    async def test_sends_a_data_url_part(self, resolved_messages: Any) -> None:
        param = _openai_client()._to_openai_chat_completion_message_param(resolved_messages[0])
        assert param["role"] == "user"
        assert param["content"] == [
            {"type": "text", "text": "before\nafter"},
            {"type": "image_url", "image_url": {"url": _EXPECTED_DATA_URL}},
        ]

    async def test_inlines_the_bytes_rather_than_a_remote_url(
        self,
        resolved_messages: Any,
    ) -> None:
        """A run must not depend on an outside host still serving the image."""
        param = _openai_client()._to_openai_chat_completion_message_param(resolved_messages[0])
        url = param["content"][1]["image_url"]["url"]
        assert url.startswith("data:image/png;base64,")
        assert "phoenix://" not in url

    async def test_rejects_a_type_openai_does_not_accept(
        self,
        db: DbSessionFactory,
    ) -> None:
        heic_bytes = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 8
        digest = hashlib.sha256(heic_bytes).hexdigest()
        async with db() as session:
            session.add(
                models.MediaFile(
                    sha256=digest,
                    media_type="image/heic",
                    size_bytes=len(heic_bytes),
                    content=heic_bytes,
                )
            )
        messages = prompt_chat_template_to_playground_messages(
            _template(url=hosted_media_url(digest), media_type="image/heic")
        )
        async with db() as session:
            resolved = await resolve_message_media(session, messages)
        with pytest.raises(BadRequest, match="does not accept image/heic"):
            _openai_client()._to_openai_chat_completion_message_param(resolved[0])

    async def test_text_only_messages_still_send_a_bare_string(
        self,
        db: DbSessionFactory,
    ) -> None:
        messages = prompt_chat_template_to_playground_messages(
            PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(role="user", content=[TextContentPart(type="text", text="hi")])
                ],
            )
        )
        param = _openai_client()._to_openai_chat_completion_message_param(messages[0])
        assert param["content"] == "hi"


class TestOpenAIResponsesImages:
    async def test_sends_an_input_image_part(self, resolved_messages: Any) -> None:
        items = _responses_client()._to_openai_response_input_item_param(resolved_messages)
        assert items[0]["content"] == [
            {"type": "input_text", "text": "before\nafter"},
            {
                "type": "input_image",
                "detail": "auto",
                "image_url": _EXPECTED_DATA_URL,
            },
        ]


class TestAnthropicImages:
    async def test_sends_base64_with_the_media_type(self, resolved_messages: Any) -> None:
        anthropic_messages, _ = _anthropic_client()._build_anthropic_messages(resolved_messages)
        assert anthropic_messages[0]["content"] == [
            {"type": "text", "text": "before\nafter"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(_PNG_BYTES).decode(),
                },
            },
        ]


class TestBedrockImages:
    async def test_sends_raw_bytes_and_a_format(self, resolved_messages: Any) -> None:
        """Converse names a format rather than a media type, and takes bytes."""
        converse = _bedrock_client()._build_converse_messages(resolved_messages)
        assert converse[0]["content"] == [
            {"text": "before\nafter"},
            {"image": {"format": "png", "source": {"bytes": _PNG_BYTES}}},
        ]


class TestEveryProviderAcceptsImagesNow:
    async def test_no_provider_rejects_a_user_image(self, resolved_messages: Any) -> None:
        """The one thing M4 is for: images are no longer Google-only."""
        parts = google_parts(resolved_messages[0])
        assert any("inline_data" in part for part in parts)
        assert _openai_client()._to_openai_chat_completion_message_param(resolved_messages[0])
        assert _responses_client()._to_openai_response_input_item_param(resolved_messages)
        assert _anthropic_client()._build_anthropic_messages(resolved_messages)[0]
        assert _bedrock_client()._build_converse_messages(resolved_messages)


class TestProviderSdkContracts:
    """
    Two fields are built with a `type: ignore`, so mypy is not checking them.
    These pin them against the SDKs' own literal sets instead.
    """

    def test_anthropic_allowlist_matches_the_sdk(self) -> None:
        import typing

        from anthropic.types import Base64ImageSourceParam

        from phoenix.server.api.helpers.playground_media import (
            ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES,
        )

        hint = typing.get_type_hints(Base64ImageSourceParam)["media_type"]
        allowed = set(typing.get_args(typing.get_args(hint)[0]))
        assert allowed == set(ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES)

    def test_bedrock_formats_match_the_sdk(self) -> None:
        import typing

        from types_aiobotocore_bedrock_runtime.type_defs import ImageBlockTypeDef

        from phoenix.server.api.helpers.playground_media import BEDROCK_IMAGE_FORMATS

        hint = typing.get_type_hints(ImageBlockTypeDef)["format"]
        assert set(typing.get_args(hint)) == set(BEDROCK_IMAGE_FORMATS.values())

    def test_google_parts_still_validate_against_the_sdk(self) -> None:
        """The Google contract test from M2, kept alongside its siblings."""
        from google.genai import types

        content = types.Content.model_validate(
            {
                "role": "user",
                "parts": [
                    {"text": "hi"},
                    {"inline_data": {"mime_type": "image/png", "data": _PNG_BYTES}},
                ],
            }
        )
        assert content.parts is not None
        assert content.parts[1].inline_data is not None
        assert content.parts[1].inline_data.data == _PNG_BYTES


_PDF_BYTES = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer<<>>\n%%EOF\n"
_PDF_DIGEST = hashlib.sha256(_PDF_BYTES).hexdigest()
_PDF_URL = hosted_media_url(_PDF_DIGEST)


@pytest.fixture
async def stored_pdf(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(
            models.MediaFile(
                sha256=_PDF_DIGEST,
                media_type="application/pdf",
                size_bytes=len(_PDF_BYTES),
                content=_PDF_BYTES,
                file_name="statement.pdf",
            )
        )


def _pdf_template() -> PromptChatTemplate:
    return PromptChatTemplate(
        type="chat",
        messages=[
            PromptMessage(
                role="user",
                content=[
                    TextContentPart(type="text", text="summarise this"),
                    FileContentPart(
                        type="file",
                        file=MediaContent(url=_PDF_URL, media_type="application/pdf"),
                    ),
                ],
            )
        ],
    )


@pytest.fixture
async def resolved_pdf(db: DbSessionFactory, stored_pdf: None) -> Any:
    async with db() as session:
        return await resolve_message_media(
            session, prompt_chat_template_to_playground_messages(_pdf_template())
        )


class TestPdfSchema:
    def test_accepts_a_pdf(self) -> None:
        part = FileContentPart(
            type="file",
            file=MediaContent(url=_PDF_URL, media_type="application/pdf"),
        )
        assert isinstance(part.file, MediaContent)
        assert part.file.media_type == "application/pdf"

    def test_rejects_an_image_as_a_file_part(self) -> None:
        with pytest.raises(ValidationError, match="unsupported file media type"):
            FileContentPart(
                type="file",
                file=MediaContent(url=_PNG_URL, media_type="image/png"),
            )

    def test_rejects_a_pdf_as_an_image_part(self) -> None:
        with pytest.raises(ValidationError, match="unsupported image media type"):
            ImageContentPart(
                type="image",
                image=MediaContent(url=_PDF_URL, media_type="application/pdf"),
            )

    def test_a_file_part_survives_serialization(self) -> None:
        part = FileContentPart(
            type="file",
            file=MediaContent(url=_PDF_URL, media_type="application/pdf"),
        )
        dumped = part.model_dump()
        assert dumped == {
            "type": "file",
            "file": {"url": _PDF_URL, "media_type": "application/pdf"},
        }
        assert FileContentPart.model_validate(dumped) == part

    def test_a_file_variable_is_named_like_an_image_one(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        FileContentPart(type="file", file=MediaVariable(variable="statement"))
                    ],
                )
            ],
        )
        assert media_variable_names(template) == ["statement"]


class TestPdfRuntime:
    async def test_blocks_record_the_kind(self, resolved_pdf: Any) -> None:
        block = message_media(resolved_pdf[0])[0]
        assert block["kind"] == "file"
        assert block["media_type"] == "application/pdf"
        assert block["data"] == _PDF_BYTES

    async def test_carries_the_stored_name(self, resolved_pdf: Any) -> None:
        """OpenAI's file part and Bedrock's document block both require a name."""
        assert message_media(resolved_pdf[0])[0]["file_name"] == "statement.pdf"


class TestPdfPerProvider:
    async def test_google_sends_a_pdf_as_inline_data(self, resolved_pdf: Any) -> None:
        """A PDF rides the same channel as an image; only the mime differs."""
        parts = google_parts(resolved_pdf[0])
        assert parts == [
            {"text": "summarise this"},
            {"inline_data": {"mime_type": "application/pdf", "data": _PDF_BYTES}},
        ]

    async def test_openai_sends_a_file_part_with_a_filename(self, resolved_pdf: Any) -> None:
        param = _openai_client()._to_openai_chat_completion_message_param(resolved_pdf[0])
        assert param["content"][1] == {
            "type": "file",
            "file": {
                "filename": "statement.pdf",
                "file_data": f"data:application/pdf;base64,{base64.b64encode(_PDF_BYTES).decode()}",
            },
        }

    async def test_responses_api_sends_an_input_file(self, resolved_pdf: Any) -> None:
        items = _responses_client()._to_openai_response_input_item_param(resolved_pdf)
        assert items[0]["content"][1] == {
            "type": "input_file",
            "filename": "statement.pdf",
            "file_data": f"data:application/pdf;base64,{base64.b64encode(_PDF_BYTES).decode()}",
        }

    async def test_anthropic_sends_a_document_block(self, resolved_pdf: Any) -> None:
        anthropic_messages, _ = _anthropic_client()._build_anthropic_messages(resolved_pdf)
        assert anthropic_messages[0]["content"][1] == {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.b64encode(_PDF_BYTES).decode(),
            },
        }

    async def test_bedrock_sends_a_named_document(self, resolved_pdf: Any) -> None:
        converse = _bedrock_client()._build_converse_messages(resolved_pdf)
        assert converse[0]["content"][1] == {
            "document": {
                "format": "pdf",
                "name": "statement.pdf",
                "source": {"bytes": _PDF_BYTES},
            }
        }

    async def test_a_pdf_and_an_image_can_share_a_message(
        self,
        db: DbSessionFactory,
        stored_png: None,
        stored_pdf: None,
    ) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="compare"),
                        _image_part(),
                        FileContentPart(
                            type="file",
                            file=MediaContent(url=_PDF_URL, media_type="application/pdf"),
                        ),
                    ],
                )
            ],
        )
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(template)
            )
        parts = google_parts(resolved[0])
        inline_data = [part["inline_data"] for part in parts if part.get("inline_data")]
        assert [blob["mime_type"] for blob in inline_data if blob] == [
            "image/png",
            "application/pdf",
        ]


class TestPdfSpanAttributes:
    """
    How a document appears in a trace.

    OpenInference's `MessageContent` is a closed union of text, image and reasoning,
    so there is nothing to record a document as. Recording one as image content made
    the trace UI draw a PDF with an `<img>` tag, which showed a broken image.
    """

    async def test_a_document_is_not_recorded_as_image_content(
        self,
        db: DbSessionFactory,
        stored_pdf: None,
    ) -> None:
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(_pdf_template())
            )
        attributes = dict(llm_input_messages(resolved))

        assert not [key for key in attributes if key.endswith("image.url")]
        assert not [value for value in attributes.values() if value == "image"], (
            "no content part should claim to be an image"
        )

    async def test_a_document_is_named_in_text_with_its_reference(
        self,
        db: DbSessionFactory,
        stored_pdf: None,
    ) -> None:
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(_pdf_template())
            )
        attributes = dict(llm_input_messages(resolved))

        texts = [value for key, value in attributes.items() if key.endswith("message_content.text")]
        assert texts[0] == "summarise this"
        # The stored name, the type, and the reference: enough to tell which document
        # was sent and to fetch the exact bytes back.
        assert "statement.pdf" in texts[1]
        assert "application/pdf" in texts[1]
        assert _PDF_URL in texts[1]

    async def test_the_description_carries_no_markdown_syntax(
        self,
        db: DbSessionFactory,
        stored_pdf: None,
    ) -> None:
        """
        The trace UI renders message text as markdown, so brackets or a bare newline
        would render as something other than what was written.
        """
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(_pdf_template())
            )
        attributes = dict(llm_input_messages(resolved))
        description = [
            value for key, value in attributes.items() if key.endswith("message_content.text")
        ][1]

        assert not any(character in description for character in "[]`*_\n")

    async def test_the_bytes_stay_out_of_the_span(
        self,
        db: DbSessionFactory,
        stored_pdf: None,
    ) -> None:
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(_pdf_template())
            )
        flattened = "".join(str(value) for value in dict(llm_input_messages(resolved)).values())

        assert base64.b64encode(_PDF_BYTES).decode() not in flattened
        assert "%PDF" not in flattened

    async def test_an_image_beside_a_document_is_still_recorded_as_an_image(
        self,
        db: DbSessionFactory,
        stored_png: None,
        stored_pdf: None,
    ) -> None:
        """The document must not cost the image its own representation."""
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        _image_part(),
                        FileContentPart(
                            type="file",
                            file=MediaContent(url=_PDF_URL, media_type="application/pdf"),
                        ),
                    ],
                )
            ],
        )
        async with db() as session:
            resolved = await resolve_message_media(
                session, prompt_chat_template_to_playground_messages(template)
            )
        attributes = dict(llm_input_messages(resolved))

        image_url_keys = [key for key in attributes if key.endswith("image.url")]
        assert [attributes[key] for key in image_url_keys] == [_PNG_URL]
        texts = [value for key, value in attributes.items() if key.endswith("message_content.text")]
        assert len(texts) == 1
        assert _PDF_URL in texts[0]
