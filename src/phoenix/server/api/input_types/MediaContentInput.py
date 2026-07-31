"""
The GraphQL inputs for media on a prompt message, and their conversion to the ORM.

Kept apart from `PromptVersionInput` so the media feature reads as one module rather
than as four fields and four conversion branches interleaved with the parts that were
already there. What remains at the call site is the field declarations — Strawberry
needs those on the input class itself — and one call.

The conversion is written against a structural protocol rather than against
`ContentPartInput`, so nothing here has to import that module and there is no cycle
in either direction.
"""

from typing import Any, Optional, Protocol

import strawberry
from pydantic import ValidationError

from phoenix.db.types.media import MediaContent, MediaVariable
from phoenix.db.types.media_parts import FileContentPart, ImageContentPart
from phoenix.db.types.prompts import ContentPart
from phoenix.server.api.exceptions import BadRequest


@strawberry.input
class ImageContentValueInput:
    url: str = strawberry.field(
        description=(
            "A `phoenix://media/<sha256>` reference to media stored in Phoenix (see the "
            "`POST /v1/media` REST endpoint), or a base64 `data:` URL carrying the media "
            "inline. External `http(s)` URLs are not accepted."
        )
    )
    media_type: str


@strawberry.input
class ImageVariableValueInput:
    variable: str = strawberry.field(
        description=(
            "The input name the image is supplied under at run time, letting one "
            "prompt run against many images."
        )
    )


def first_validation_error_message(error: ValidationError) -> str:
    """
    The first message from a pydantic validation error, without its location prefix.

    A media reference is rejected by the model's own validators, and the caller who
    sent it wants the reason rather than pydantic's full report.

    Args:
        error: The validation error raised while building the ORM model.

    Returns:
        The first error's message, or the error's string form if it has none.
    """
    errors = error.errors()
    if not errors:
        return str(error)
    message = errors[0].get("msg", "")
    return str(message) or str(error)


class HasMediaFields(Protocol):
    """
    The media fields of a content-part input.

    Structural, so the conversion needs no import of the class that declares them —
    which is what keeps this module independent of `PromptVersionInput`.
    """

    image: Any
    image_variable: Any
    file: Any
    file_variable: Any


def media_content_part(part: HasMediaFields) -> Optional[ContentPart]:
    """
    The content part for whichever media field is set, if any.

    Args:
        part: A content-part input.

    Returns:
        The media content part, or None when the input carries no media and the caller
        should go on to its text, tool-call and tool-result branches.

    Raises:
        BadRequest: The reference is one the model rejects — an external URL, say, or a
            media type that does not match the data URL carrying it.
    """
    try:
        if part.file_variable:
            return FileContentPart(
                type="file",
                file=MediaVariable(variable=part.file_variable.variable),
            )
        if part.file:
            return FileContentPart(
                type="file",
                file=MediaContent(url=part.file.url, media_type=part.file.media_type),
            )
        if part.image_variable:
            return ImageContentPart(
                type="image",
                image=MediaVariable(variable=part.image_variable.variable),
            )
        if part.image:
            return ImageContentPart(
                type="image",
                image=MediaContent(url=part.image.url, media_type=part.image.media_type),
            )
    except ValidationError as error:
        raise BadRequest(first_validation_error_message(error))
    return None
