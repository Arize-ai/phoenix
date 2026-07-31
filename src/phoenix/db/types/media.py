"""
Media references used inside prompt templates.

Binary media is never stored as raw bytes inside a prompt template. A prompt
content part holds a :class:`MediaContent` whose ``url`` names the media using
one of two schemes:

``phoenix://media/<sha256>``
    Media held in Phoenix's ``media_files`` table, addressed by the SHA-256
    digest of its bytes. Preferred: identical media is stored once no matter how
    many prompt versions reference it, so re-saving a prompt version whose image
    is unchanged costs no additional storage.

``data:<media_type>;base64,<payload>``
    Media carried inline in the prompt template. Useful for small payloads and
    for prompts authored outside Phoenix, at the cost of duplicating the payload
    into every prompt version that references it.

External ``http(s)://`` URLs are deliberately not accepted. Resolving one
requires Phoenix to fetch a user-supplied URL server-side, which needs its own
egress controls, and the providers that cannot accept a remote URL directly
would need the fetch anyway.
"""

import base64
import binascii
import re
from typing import NamedTuple, Union

from pydantic import model_validator
from typing_extensions import Self, TypeAlias

from phoenix.db.types.db_helper_types import DBBaseModel

MEDIA_URL_PREFIX = "phoenix://media/"
"""Scheme prefix for media held in Phoenix's ``media_files`` table."""

SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    (
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/heic",
        "image/heif",
    )
)
"""
Image media types accepted by at least one supported model provider.

Individual providers accept narrower sets than this union — Google rejects GIF,
Anthropic rejects HEIC — so a provider adapter validates again at request time.

``image/svg+xml`` is deliberately excluded: SVG can carry script, and Phoenix
serves uploaded media back from its own origin.
"""

SUPPORTED_FILE_MEDIA_TYPES = frozenset(("application/pdf",))
"""
Document media types accepted by at least one supported model provider.

PDF only for now. Providers differ in how they carry a document — some want the
bytes, some a base64 payload, and some require a filename alongside — but they all
agree on PDF, which is why it comes first.
"""

SUPPORTED_MEDIA_TYPES = SUPPORTED_IMAGE_MEDIA_TYPES | SUPPORTED_FILE_MEDIA_TYPES
"""Every media type Phoenix will store."""

_SHA256_PATTERN = re.compile(r"\A[0-9a-f]{64}\Z")
_DATA_URL_PATTERN = re.compile(
    r"\Adata:(?P<media_type>[-\w.+]+/[-\w.+]+)(?P<parameters>;[^,]*)?,(?P<payload>.*)\Z",
    re.DOTALL,
)


class HostedMediaRef(NamedTuple):
    """A reference to media held in Phoenix's ``media_files`` table."""

    sha256: str


class InlineMedia(NamedTuple):
    """Media carried inline in a ``data:`` URL."""

    media_type: str
    payload: str
    """The still-encoded base64 payload. Call :meth:`decode` for the bytes."""

    def decode(self) -> bytes:
        """
        Decode the inline payload.

        Returns:
            The media bytes.

        Raises:
            ValueError: The payload is not valid base64.
        """
        try:
            return base64.b64decode(self.payload, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError(f"data URL payload is not valid base64: {error}")


MediaRef: TypeAlias = Union[HostedMediaRef, InlineMedia]


def hosted_media_url(sha256: str) -> str:
    """
    Build the prompt-template URL that references Phoenix-hosted media.

    Args:
        sha256: Lowercase hex SHA-256 digest of the media bytes.

    Returns:
        A ``phoenix://media/<sha256>`` URL.

    Raises:
        ValueError: The digest is not 64 lowercase hexadecimal characters.
    """
    if not _SHA256_PATTERN.match(sha256):
        raise ValueError("media digest must be 64 lowercase hexadecimal characters")
    return f"{MEDIA_URL_PREFIX}{sha256}"


def parse_media_url(url: str) -> MediaRef:
    """
    Parse a prompt media URL into the reference it denotes.

    Structural only: an inline payload is not decoded here, so that validating a
    prompt template on every read stays cheap regardless of media size.

    Args:
        url: A ``phoenix://media/<sha256>`` or base64 ``data:`` URL.

    Returns:
        A :class:`HostedMediaRef` or :class:`InlineMedia` naming where the bytes
        come from.

    Raises:
        ValueError: The URL is malformed or uses an unsupported scheme.
    """
    if url.startswith(MEDIA_URL_PREFIX):
        sha256 = url[len(MEDIA_URL_PREFIX) :]
        if not _SHA256_PATTERN.match(sha256):
            raise ValueError(
                f"malformed Phoenix media URL: expected '{MEDIA_URL_PREFIX}<sha256>' "
                f"with a 64-character lowercase hexadecimal digest"
            )
        return HostedMediaRef(sha256=sha256)
    if url.startswith("data:"):
        if (match := _DATA_URL_PATTERN.match(url)) is None:
            raise ValueError("malformed data URL: expected 'data:<media_type>;base64,<payload>'")
        if "base64" not in (match.group("parameters") or "").split(";"):
            raise ValueError("data URLs must be base64-encoded")
        return InlineMedia(
            media_type=match.group("media_type").lower(),
            payload=match.group("payload"),
        )
    scheme = url.split(":", 1)[0] if ":" in url else url
    raise ValueError(
        f"unsupported media URL scheme '{scheme}': prompt media must use "
        f"'{MEDIA_URL_PREFIX}<sha256>' or a base64 data URL"
    )


class MediaContent(DBBaseModel):
    """Binary media referenced by a prompt content part."""

    url: str
    media_type: str

    @model_validator(mode="after")
    def _validate_source(self) -> Self:
        reference = parse_media_url(self.url)
        if isinstance(reference, InlineMedia) and reference.media_type != self.media_type.lower():
            raise ValueError(
                f"media_type '{self.media_type}' does not match the type declared "
                f"by the data URL ('{reference.media_type}')"
            )
        return self


class MediaVariable(DBBaseModel):
    """
    Media supplied when the prompt runs, named by a template variable.

    Lets one prompt run against many images: the template reserves the position,
    and the caller provides the media per run — the same relationship text
    variables have with their surrounding text. The media's kind comes from the
    content part holding this (an image part means an image), so only the name is
    recorded here; the exact media type is not known until a value is supplied.
    """

    variable: str

    @model_validator(mode="after")
    def _validate_variable_name(self) -> Self:
        if not self.variable.strip():
            raise ValueError("media variable name cannot be empty")
        if self.variable != self.variable.strip():
            raise ValueError(
                f"media variable name '{self.variable}' cannot have leading or trailing whitespace"
            )
        return self


MediaSource: TypeAlias = Union[MediaContent, MediaVariable]
"""
Where a content part's media comes from.

Deliberately untagged: ``MediaContent`` keeps the exact shape it was first stored
with, so prompt versions written before media variables existed still validate.
``DBBaseModel`` forbids extra fields, which makes the two shapes mutually
exclusive and the union unambiguous.
"""
