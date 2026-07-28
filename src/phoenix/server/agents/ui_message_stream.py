"""Phoenix-specific adapters for Vercel UI-message streams.

This module exists to keep Phoenix's protocol extensions out of
``vercel_ui_message_stream``, which is a faithful port of the AI SDK reducer
pinned by conformance fixtures and must not accumulate Phoenix behavior.
Extensions to the standard chunk stream live here instead.
"""

from collections.abc import AsyncIterator
from typing import Literal

from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk, ErrorChunk

from phoenix.db.types.data_stream_protocol import AgentErrorData
from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
)


class AgentErrorChunk(DataChunk):
    """Durable data part paired with a standard protocol ``error`` chunk.

    Standard ``error`` chunks are transient: the reducer routes them to error
    callbacks without adding a message part, so they vanish from persisted
    transcripts. Pairing each one with this ``data-error`` part records the
    error durably in the message for persistence, reload, and subagents.
    """

    type: Literal["data-error"] = "data-error"
    data: AgentErrorData


async def iter_chunks_with_error_parts(
    chunks: AsyncIterator[BaseChunk],
) -> AsyncIterator[BaseChunk]:
    """Pair standard error chunks with durable Phoenix ``data-error`` parts."""
    async for chunk in chunks:
        if isinstance(chunk, ErrorChunk):
            yield AgentErrorChunk(data=AgentErrorData(error_text=chunk.error_text))
        yield chunk


# HTTP status codes a model provider returns when it rejects the API key.
_AUTH_ERROR_STATUS_CODES = frozenset({401, 403})

# Substrings that mark a provider error as an API-key / authentication failure.
# Matched case-insensitively against the exception text as a fallback for
# providers whose SDKs don't surface a structured HTTP status code.
_API_KEY_ERROR_PATTERNS = (
    "api key",
    "api_key",
    "apikey",
    "x-api-key",
    "invalid_api_key",
    "unauthorized",
    "authentication",
    "authenticate",
    "credential",
    "permission denied",
    "permission_denied",
)


def is_api_key_error(exc: BaseException) -> bool:
    """Return ``True`` when ``exc`` looks like a model-provider API-key failure.

    Covers three cases: the agent's own credential exceptions
    (:class:`~phoenix.server.agents.exceptions.ProviderCredentialsError` and
    :class:`~phoenix.server.agents.exceptions.ProviderConfigError`), provider
    HTTP errors carrying a ``401``/``403`` status code (e.g. pydantic-ai's
    ``ModelHTTPError``), and, as a fallback, exceptions whose text mentions an
    API key or authentication problem.
    """
    if isinstance(exc, (ProviderCredentialsError, ProviderConfigError)):
        return True
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int) and status_code in _AUTH_ERROR_STATUS_CODES:
        return True
    message = str(exc).lower()
    return any(pattern in message for pattern in _API_KEY_ERROR_PATTERNS)


def format_stream_error_text(exc: BaseException) -> str:
    """Build a clear, user-facing message for a failed agent stream.

    API-key / provider-authentication failures get actionable remediation
    guidance pointing the user at their model settings; any other error falls
    back to the underlying exception text so it is still surfaced to the user
    instead of being silently dropped.
    """
    detail = str(exc).strip() or type(exc).__name__
    if is_api_key_error(exc):
        return (
            "The model provider rejected the request because the API key is "
            "missing, invalid, or misconfigured. Add a valid API key for the "
            "selected model in Settings, then try again.\n\n"
            f"Provider error: {detail}"
        )
    return detail


def build_stream_error_chunk(exc: BaseException) -> ErrorChunk:
    """Wrap ``exc`` in a Vercel AI :class:`ErrorChunk` for the response stream.

    Emitting this chunk mid-stream ensures the client surfaces the failure in
    the chat error banner instead of the connection closing silently, which is
    what leaves the agent appearing to hang when, for example, an API key is
    rejected by the provider.
    """
    return ErrorChunk(error_text=format_stream_error_text(exc))
