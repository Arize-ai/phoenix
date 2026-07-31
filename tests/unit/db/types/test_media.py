from __future__ import annotations

import base64

import pytest
from pydantic import ValidationError

from phoenix.db.types.media import (
    HostedMediaRef,
    InlineMedia,
    MediaContent,
    MediaVariable,
    hosted_media_url,
    parse_media_url,
)
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    TextContentPart,
)
from phoenix.db.types.media_parts import (
    ImageContentPart,
    media_variable_names,
)

_DIGEST = "a" * 64
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
_PNG_DATA_URL = f"data:image/png;base64,{base64.b64encode(_PNG_BYTES).decode()}"


class TestParseMediaUrl:
    def test_parses_hosted_reference(self) -> None:
        assert parse_media_url(f"phoenix://media/{_DIGEST}") == HostedMediaRef(sha256=_DIGEST)

    def test_parses_data_url_without_decoding_payload(self) -> None:
        reference = parse_media_url(_PNG_DATA_URL)
        assert isinstance(reference, InlineMedia)
        assert reference.media_type == "image/png"
        assert reference.decode() == _PNG_BYTES

    def test_normalizes_data_url_media_type_case(self) -> None:
        reference = parse_media_url("data:IMAGE/PNG;base64,aGk=")
        assert isinstance(reference, InlineMedia)
        assert reference.media_type == "image/png"

    def test_accepts_data_url_with_extra_parameters(self) -> None:
        reference = parse_media_url("data:image/png;charset=utf-8;base64,aGk=")
        assert isinstance(reference, InlineMedia)
        assert reference.media_type == "image/png"

    @pytest.mark.parametrize(
        "url",
        [
            pytest.param("phoenix://media/tooshort", id="short-digest"),
            pytest.param(f"phoenix://media/{'A' * 64}", id="uppercase-digest"),
            pytest.param(f"phoenix://media/{'z' * 64}", id="non-hex-digest"),
            pytest.param("phoenix://media/", id="empty-digest"),
        ],
    )
    def test_rejects_malformed_hosted_reference(self, url: str) -> None:
        with pytest.raises(ValueError, match="malformed Phoenix media URL"):
            parse_media_url(url)

    def test_rejects_data_url_that_is_not_base64(self) -> None:
        with pytest.raises(ValueError, match="must be base64-encoded"):
            parse_media_url("data:image/png,notbase64")

    @pytest.mark.parametrize(
        "url",
        [
            pytest.param("https://example.com/cat.png", id="https"),
            pytest.param("http://example.com/cat.png", id="http"),
            pytest.param("file:///etc/passwd", id="file"),
            pytest.param("gs://bucket/cat.png", id="gcs"),
            pytest.param("cat.png", id="bare-path"),
        ],
    )
    def test_rejects_unsupported_schemes(self, url: str) -> None:
        with pytest.raises(ValueError, match="unsupported media URL scheme"):
            parse_media_url(url)


class TestHostedMediaUrl:
    def test_builds_url(self) -> None:
        assert hosted_media_url(_DIGEST) == f"phoenix://media/{_DIGEST}"

    def test_rejects_invalid_digest(self) -> None:
        with pytest.raises(ValueError, match="64 lowercase hexadecimal"):
            hosted_media_url("not-a-digest")


class TestInlineMediaDecode:
    def test_rejects_corrupt_payload(self) -> None:
        with pytest.raises(ValueError, match="not valid base64"):
            InlineMedia(media_type="image/png", payload="!!!not-base64!!!").decode()


class TestMediaContent:
    def test_accepts_hosted_reference(self) -> None:
        media = MediaContent(url=f"phoenix://media/{_DIGEST}", media_type="image/png")
        assert media.media_type == "image/png"

    def test_accepts_matching_data_url(self) -> None:
        assert MediaContent(url=_PNG_DATA_URL, media_type="image/png").url == _PNG_DATA_URL

    def test_rejects_media_type_conflicting_with_data_url(self) -> None:
        with pytest.raises(ValidationError, match="does not match the type declared"):
            MediaContent(url=_PNG_DATA_URL, media_type="image/jpeg")

    def test_rejects_external_url(self) -> None:
        with pytest.raises(ValidationError, match="unsupported media URL scheme"):
            MediaContent(url="https://example.com/cat.png", media_type="image/png")


class TestImageContentPart:
    def test_accepts_supported_media_type(self) -> None:
        part = ImageContentPart(
            type="image",
            image=MediaContent(url=f"phoenix://media/{_DIGEST}", media_type="image/webp"),
        )
        assert isinstance(part.image, MediaContent)
        assert part.image.media_type == "image/webp"

    @pytest.mark.parametrize(
        "media_type",
        [
            pytest.param("application/pdf", id="pdf"),
            pytest.param("image/svg+xml", id="svg"),
            pytest.param("text/html", id="html"),
            pytest.param("audio/mpeg", id="audio"),
        ],
    )
    def test_rejects_unsupported_media_type(self, media_type: str) -> None:
        with pytest.raises(ValidationError, match="unsupported image media type"):
            ImageContentPart(
                type="image",
                image=MediaContent(url=f"phoenix://media/{_DIGEST}", media_type=media_type),
            )


class TestMediaPlacement:
    @staticmethod
    def _image_part() -> ImageContentPart:
        return ImageContentPart(
            type="image",
            image=MediaContent(url=f"phoenix://media/{_DIGEST}", media_type="image/png"),
        )

    def test_allows_media_on_user_messages(self) -> None:
        message = PromptMessage(
            role="user",
            content=[TextContentPart(type="text", text="describe this"), self._image_part()],
        )
        assert len(message.content) == 2

    @pytest.mark.parametrize(
        "role",
        [
            pytest.param("system", id="system"),
            pytest.param("developer", id="developer"),
            pytest.param("assistant", id="assistant"),
            pytest.param("ai", id="ai"),
            pytest.param("model", id="model"),
            pytest.param("tool", id="tool"),
        ],
    )
    def test_rejects_media_on_other_roles(self, role: str) -> None:
        with pytest.raises(ValidationError, match="only supported on 'user' messages"):
            PromptMessage(role=role, content=[self._image_part()])

    def test_allows_text_on_other_roles(self) -> None:
        message = PromptMessage(
            role="system",
            content=[TextContentPart(type="text", text="you are helpful")],
        )
        assert len(message.content) == 1


class TestChatTemplateRoundTrip:
    def test_image_part_survives_serialization(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="what is this?"),
                        ImageContentPart(
                            type="image",
                            image=MediaContent(
                                url=f"phoenix://media/{_DIGEST}",
                                media_type="image/png",
                            ),
                        ),
                    ],
                )
            ],
        )
        dumped = template.model_dump()
        assert dumped["messages"][0]["content"][1] == {
            "type": "image",
            "image": {"url": f"phoenix://media/{_DIGEST}", "media_type": "image/png"},
        }
        assert PromptChatTemplate.model_validate(dumped) == template


class TestMediaVariable:
    def test_accepts_a_name(self) -> None:
        assert MediaVariable(variable="question_image").variable == "question_image"

    @pytest.mark.parametrize(
        "name",
        [pytest.param("", id="empty"), pytest.param("   ", id="whitespace")],
    )
    def test_rejects_an_empty_name(self, name: str) -> None:
        with pytest.raises(ValidationError, match="cannot be empty"):
            MediaVariable(variable=name)

    def test_rejects_surrounding_whitespace(self) -> None:
        with pytest.raises(ValidationError, match="leading or trailing whitespace"):
            MediaVariable(variable=" question_image ")


class TestMediaSourceUnion:
    """
    The union is untagged, so the two shapes must stay mutually exclusive — that is
    what lets prompt versions written before media variables existed keep validating.
    """

    def test_a_stored_shape_still_resolves_to_media_content(self) -> None:
        part = ImageContentPart.model_validate(
            {
                "type": "image",
                "image": {"url": f"phoenix://media/{_DIGEST}", "media_type": "image/png"},
            }
        )
        assert isinstance(part.image, MediaContent)

    def test_a_variable_shape_resolves_to_media_variable(self) -> None:
        part = ImageContentPart.model_validate(
            {"type": "image", "image": {"variable": "question_image"}}
        )
        assert isinstance(part.image, MediaVariable)

    def test_rejects_a_mixed_shape(self) -> None:
        with pytest.raises(ValidationError):
            ImageContentPart.model_validate(
                {
                    "type": "image",
                    "image": {"url": f"phoenix://media/{_DIGEST}", "variable": "x"},
                }
            )

    def test_a_variable_skips_the_media_type_allowlist(self) -> None:
        """Its type is only knowable once a value is supplied."""
        part = ImageContentPart(type="image", image=MediaVariable(variable="img"))
        assert isinstance(part.image, MediaVariable)

    def test_round_trips_through_serialization(self) -> None:
        part = ImageContentPart(type="image", image=MediaVariable(variable="img"))
        dumped = part.model_dump()
        assert dumped == {"type": "image", "image": {"variable": "img"}}
        assert ImageContentPart.model_validate(dumped) == part


class TestMediaVariableNames:
    def test_lists_names_in_order_without_duplicates(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        ImageContentPart(type="image", image=MediaVariable(variable="second")),
                        TextContentPart(type="text", text="hi"),
                        ImageContentPart(type="image", image=MediaVariable(variable="first")),
                        ImageContentPart(type="image", image=MediaVariable(variable="second")),
                    ],
                )
            ],
        )
        assert media_variable_names(template) == ["second", "first"]

    def test_ignores_stored_references(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        ImageContentPart(
                            type="image",
                            image=MediaContent(
                                url=f"phoenix://media/{_DIGEST}", media_type="image/png"
                            ),
                        )
                    ],
                )
            ],
        )
        assert media_variable_names(template) == []
