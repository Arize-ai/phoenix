"""
Media handling for the playground's provider clients.

A package rather than a module, and split by provider, for two reasons.

The first is ordinary: each provider carries media on its own wire format, and
those formats have nothing in common beyond needing the bytes and a media type.
Keeping them apart means a change to how Anthropic takes a document cannot disturb
how Bedrock does.

The second is about living on a fork. `playground_clients` is where upstream lands
new providers and models, so it changes constantly; media support is orthogonal to
that work and would otherwise be interleaved through every one of those changes.
Every path in this package is one upstream does not have, so none of it can
conflict — and when a provider is added, the work is a new file here plus a single
call in the client rather than another block inside the busy module.

Each provider module exposes one entry point that turns a resolved message into
that provider's content shape. The client's job is to call it.
"""

from ._allowlists import (
    ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES,
    ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES,
    BEDROCK_DOCUMENT_FORMATS,
    BEDROCK_IMAGE_FORMATS,
    BEDROCK_SUPPORTED_FILE_MEDIA_TYPES,
    BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES,
    GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES,
    GOOGLE_SUPPORTED_MEDIA_TYPES,
    OPENAI_SUPPORTED_FILE_MEDIA_TYPES,
    OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES,
)
from ._anthropic import anthropic_media_content
from ._bedrock import bedrock_content_blocks
from ._google import google_parts
from ._openai import (
    openai_chat_content_parts,
    openai_chat_media_message,
    openai_responses_content_parts,
)
from ._support import media_data_url, media_file_name, require_resolved_media
from ._tracing import oi_message_content

__all__ = [
    "ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES",
    "ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES",
    "BEDROCK_DOCUMENT_FORMATS",
    "BEDROCK_IMAGE_FORMATS",
    "BEDROCK_SUPPORTED_FILE_MEDIA_TYPES",
    "BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES",
    "GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES",
    "GOOGLE_SUPPORTED_MEDIA_TYPES",
    "OPENAI_SUPPORTED_FILE_MEDIA_TYPES",
    "OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES",
    "anthropic_media_content",
    "bedrock_content_blocks",
    "google_parts",
    "openai_chat_content_parts",
    "openai_chat_media_message",
    "openai_responses_content_parts",
    "media_data_url",
    "media_file_name",
    "oi_message_content",
    "require_resolved_media",
]
