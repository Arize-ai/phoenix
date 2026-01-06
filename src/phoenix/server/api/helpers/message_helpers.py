"""
Helper functions for extracting and converting messages from dataset examples.

This module provides utilities for the "appended messages" feature, which allows
users to specify a path to conversation messages within dataset examples that
should be appended to prompt templates when running experiments.
"""

import json
from typing import Any, Optional

from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole

# Type alias matching the one used in subscriptions.py
ChatCompletionMessage = tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]

# Mapping from OpenAI role strings to internal enum values
_ROLE_MAPPING = {
    "user": ChatCompletionMessageRole.USER,
    "assistant": ChatCompletionMessageRole.AI,
    "model": ChatCompletionMessageRole.AI,
    "system": ChatCompletionMessageRole.SYSTEM,
    "developer": ChatCompletionMessageRole.SYSTEM,
    "tool": ChatCompletionMessageRole.TOOL,
    # Also handle our internal names
    "ai": ChatCompletionMessageRole.AI,
}


def extract_value_from_path(data: dict[str, Any], path: str) -> Any:
    """
    Extract a value from a nested dictionary using dot-notation path.

    Args:
        data: The dictionary to extract from
        path: Dot-notation path (e.g., "messages" or "input.messages")

    Returns:
        The value at the specified path

    Raises:
        KeyError: If the path doesn't exist in the data
        TypeError: If the path traverses through a non-dict value
    """
    if not path:
        raise KeyError("Empty path provided")

    keys = path.split(".")
    current = data

    for key in keys:
        if not isinstance(current, dict):
            raise TypeError(f"Cannot traverse path '{path}': intermediate value is not a dict")
        if key not in current:
            raise KeyError(f"Key '{key}' not found in path '{path}'")
        current = current[key]

    return current


def _role_to_enum(role: str) -> ChatCompletionMessageRole:
    """
    Convert an OpenAI-format role string to ChatCompletionMessageRole enum.

    Args:
        role: Role string (e.g., "user", "assistant", "system", "tool")

    Returns:
        Corresponding ChatCompletionMessageRole enum value
    """
    role_lower = role.lower()
    if role_lower not in _ROLE_MAPPING:
        # Default to USER for unknown roles
        return ChatCompletionMessageRole.USER
    return _ROLE_MAPPING[role_lower]


def _convert_tool_calls_to_json_strings(tool_calls: list[dict[str, Any]]) -> list[str]:
    """
    Convert OpenAI tool_calls format to list of JSON strings.

    The internal format stores tool_calls as JSON strings for flexibility.

    Args:
        tool_calls: List of tool call dicts in OpenAI format

    Returns:
        List of JSON-serialized tool call strings
    """
    return [json.dumps(tc) for tc in tool_calls]


def convert_openai_message_to_internal(
    message: dict[str, Any],
) -> ChatCompletionMessage:
    """
    Convert an OpenAI-format message to the internal ChatCompletionMessage tuple.

    OpenAI format:
        {"role": "user", "content": "Hello"}
        {"role": "assistant", "content": "Hi", "tool_calls": [...]}
        {"role": "tool", "content": "result", "tool_call_id": "call_123"}

    Internal format:
        (ChatCompletionMessageRole, content_str, tool_call_id, tool_calls_list)

    Args:
        message: Message dict in OpenAI format

    Returns:
        ChatCompletionMessage tuple
    """
    role = _role_to_enum(message.get("role", "user"))

    # Content can be a string or null
    content = message.get("content")
    if content is None:
        content = ""
    elif not isinstance(content, str):
        # Handle array content (multimodal) by extracting text parts
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
                elif isinstance(part, str):
                    text_parts.append(part)
            content = "\n".join(text_parts)
        else:
            content = str(content)

    # Extract tool_call_id (for tool response messages)
    tool_call_id: Optional[str] = message.get("tool_call_id")

    # Extract tool_calls (for assistant messages with function calls)
    tool_calls_raw = message.get("tool_calls")
    tool_calls: Optional[list[str]] = None
    if tool_calls_raw and isinstance(tool_calls_raw, list):
        tool_calls = _convert_tool_calls_to_json_strings(tool_calls_raw)

    return (role, content, tool_call_id, tool_calls)


def extract_and_convert_example_messages(
    data: dict[str, Any],
    path: str,
) -> list[ChatCompletionMessage]:
    """
    Extract messages from a dataset example and convert them to internal format.

    This is the main entry point for the appended messages feature. It extracts
    a list of messages from a dataset example's input using a dot-notation path,
    then converts each message from OpenAI format to the internal tuple format.

    Args:
        data: The dataset example input dictionary
        path: Dot-notation path to the messages list

    Returns:
        List of ChatCompletionMessage tuples ready to be appended to a prompt

    Raises:
        KeyError: If the path doesn't exist in the data
        TypeError: If the value at the path is not a list
        ValueError: If messages in the list are not valid message dicts
    """
    messages_raw = extract_value_from_path(data, path)

    if not isinstance(messages_raw, list):
        raise TypeError(f"Value at path '{path}' is not a list (got {type(messages_raw).__name__})")

    messages: list[ChatCompletionMessage] = []
    for i, msg in enumerate(messages_raw):
        if not isinstance(msg, dict):
            raise ValueError(f"Message at index {i} is not a dict (got {type(msg).__name__})")
        messages.append(convert_openai_message_to_internal(msg))

    return messages
