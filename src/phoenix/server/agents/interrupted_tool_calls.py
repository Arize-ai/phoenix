"""Resolving tool calls left dangling by an interrupted client tool execution.

When a browser agent turn is interrupted while a client-executed tool call is
pending (the user hits Stop, or the tab is closed/reloaded before the tool
resolves), the browser only cleans up its own local state. The assistant
message already persisted to the session carries the tool part in
``input-available`` (or ``input-streaming``) state with no matching result.

Because the server rebuilds model history from persisted messages on every
send, resuming the session from a different surface (another browser tab, the
CLI) turns that dangling part into a bare tool-call with no return value.
Providers reject a tool call without a result, so the turn hard-fails with an
opaque provider error and there is no way to clear it outside the original tab.

This module sanitizes the history at load time: any unresolved tool-call part
is replaced with a synthetic ``output-error`` result noting that the call was
never serviced, so the turn can proceed instead of hard-failing.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, TypeVar

from pydantic_ai.ui.vercel_ai.request_types import (
    ToolInputAvailablePart,
    ToolInputStreamingPart,
    ToolOutputErrorPart,
    UIMessage,
)

UIMessageT = TypeVar("UIMessageT", bound=UIMessage)

_UNRESOLVED_TOOL_CALL_ERROR = (
    "This tool call was left unresolved by an interrupted session (execution "
    "environment: {environment}) and cannot be completed from the current "
    "session. Treat it as failed and, if needed, ask the user to retry."
)


def _tool_execution_environment(call_provider_metadata: dict[str, dict[str, Any]] | None) -> str:
    """Read the execution environment Phoenix stamped on the tool call, if any."""
    phoenix_metadata = (call_provider_metadata or {}).get("phoenix")
    if isinstance(phoenix_metadata, dict):
        environment = phoenix_metadata.get("tool_execution_environment")
        if isinstance(environment, str):
            return environment
    return "unknown"


def _resolve_unresolved_part(
    part: ToolInputAvailablePart | ToolInputStreamingPart,
) -> ToolOutputErrorPart:
    """Turn a dangling tool-call part into a synthetic ``output-error`` result."""
    return ToolOutputErrorPart(
        type=part.type,
        tool_call_id=part.tool_call_id,
        title=part.title,
        input=part.input,
        error_text=_UNRESOLVED_TOOL_CALL_ERROR.format(
            environment=_tool_execution_environment(part.call_provider_metadata)
        ),
        provider_executed=part.provider_executed,
        call_provider_metadata=part.call_provider_metadata,
    )


def resolve_unresolved_tool_calls(
    messages: Sequence[UIMessageT],
) -> list[UIMessageT]:
    """Replace dangling tool-call parts with a synthetic failed result.

    Scans assistant messages for tool parts still in ``input-available`` or
    ``input-streaming`` state - a call that was made (or was being made) but
    never got a result and never will, since the session that would have
    supplied one is gone. Approval-pending parts (``approval-requested``) are
    left untouched: those are a distinct, still-resolvable state handled by
    the deferred tool-result flow.

    Args:
        messages: The chat message history from the request body.

    Returns:
        A new message list with unresolved tool-call parts replaced in place.
        Messages without one are returned unchanged. Returns a new list (with
        the original messages untouched) even when nothing needed resolving.
    """
    result: list[UIMessageT] = []
    for message in messages:
        if message.role != "assistant" or not any(
            isinstance(part, (ToolInputAvailablePart, ToolInputStreamingPart))
            for part in message.parts
        ):
            result.append(message)
            continue
        new_parts = [
            _resolve_unresolved_part(part)
            if isinstance(part, (ToolInputAvailablePart, ToolInputStreamingPart))
            else part
            for part in message.parts
        ]
        result.append(message.model_copy(update={"parts": new_parts}))
    return result
