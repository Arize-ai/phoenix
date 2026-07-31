"""
The media content parts a prompt message can carry.

Kept out of `prompts` so the media feature reads as one module rather than as
additions interleaved with the part definitions that were already there. `prompts`
imports these to name them in its `ContentPart` union; the annotations pointing back
the other way are type-checking only, so there is no import cycle at runtime.
"""

from typing import TYPE_CHECKING, Literal, Optional, Union

from pydantic import model_validator
from typing_extensions import Self, TypeAlias, TypeGuard

from phoenix.db.types.db_helper_types import DBBaseModel
from phoenix.db.types.media import (
    SUPPORTED_FILE_MEDIA_TYPES,
    SUPPORTED_IMAGE_MEDIA_TYPES,
    MediaContent,
    MediaSource,
    MediaVariable,
)

if TYPE_CHECKING:
    from phoenix.db.types.prompts import ContentPart, PromptChatTemplate


class ImageContentPart(DBBaseModel):
    type: Literal["image"]
    image: MediaSource

    @model_validator(mode="after")
    def _validate_media_type(self) -> Self:
        # A variable's media type is only known once a value is supplied, so it is
        # checked when the run resolves it rather than when the prompt is written.
        if isinstance(self.image, MediaContent):
            if self.image.media_type.lower() not in SUPPORTED_IMAGE_MEDIA_TYPES:
                raise ValueError(
                    f"unsupported image media type '{self.image.media_type}'; expected one of "
                    f"{', '.join(sorted(SUPPORTED_IMAGE_MEDIA_TYPES))}"
                )
        return self


class FileContentPart(DBBaseModel):
    type: Literal["file"]
    file: MediaSource

    @model_validator(mode="after")
    def _validate_media_type(self) -> Self:
        # As with images, a variable's type is only known once a value is supplied.
        if isinstance(self.file, MediaContent):
            if self.file.media_type.lower() not in SUPPORTED_FILE_MEDIA_TYPES:
                raise ValueError(
                    f"unsupported file media type '{self.file.media_type}'; expected one of "
                    f"{', '.join(sorted(SUPPORTED_FILE_MEDIA_TYPES))}"
                )
        return self


MediaContentPart: TypeAlias = Union[ImageContentPart, FileContentPart]
"""A content part carrying binary media, whatever its kind."""


def is_media_content_part(part: "ContentPart") -> TypeGuard[MediaContentPart]:
    """Whether a content part carries binary media rather than text or tool traffic."""
    return isinstance(part, (ImageContentPart, FileContentPart))


def media_source(part: MediaContentPart) -> MediaSource:
    """
    Where a media part's content comes from, regardless of its kind.

    Args:
        part: An image or file content part.

    Returns:
        The stored reference or the variable naming it.
    """
    return part.image if isinstance(part, ImageContentPart) else part.file


def media_variable_name(part: "ContentPart") -> Optional[str]:
    """
    The input name a content part's media is supplied under.

    Args:
        part: The content part to inspect.

    Returns:
        The variable name, or ``None`` when the part holds no media or names a
        stored reference instead of a variable.
    """
    if is_media_content_part(part):
        source = media_source(part)
        if isinstance(source, MediaVariable):
            return source.variable
    return None


def media_variable_names(template: "PromptChatTemplate") -> list[str]:
    """
    The media variables a chat template expects, in the order they appear.

    Args:
        template: The template to scan.

    Returns:
        Variable names, deduplicated while preserving first appearance so that the
        inputs a caller must supply read in the same order as the prompt.
    """
    names: list[str] = []
    for message in template.messages:
        if isinstance(message.content, str):
            continue
        for part in message.content:
            name = media_variable_name(part)
            if name is not None and name not in names:
                names.append(name)
    return names


def reject_media_on_non_user_role(
    role: str,
    content: Union[str, list["ContentPart"]],
) -> None:
    """
    Refuse media on a message that is not a user turn.

    No supported provider accepts media in a system instruction, and provider support
    for media in assistant and tool messages is inconsistent. A validation rule rather
    than a schema constraint, so it can be relaxed per-role later without a breaking
    change.

    Args:
        role: The message's role.
        content: The message's content.

    Raises:
        ValueError: The message carries media on a role that may not.
    """
    if role == "user" or isinstance(content, str):
        return
    for part in content:
        if is_media_content_part(part):
            raise ValueError(
                f"media content is only supported on 'user' messages, not on '{role}' messages"
            )
