from typing import Any

import pytest
from pydantic import ValidationError

from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    PhoenixUIMessageAdapter,
    TextUIPart,
)


def _message_with_call_provider_metadata(
    call_provider_metadata: dict[str, Any],
) -> dict[str, Any]:
    """A one-part assistant message whose resolved tool part carries the given
    ``callProviderMetadata``."""
    return {
        "id": "assistant-1",
        "role": "assistant",
        "parts": [
            {
                "type": "tool-open_page",
                "toolCallId": "call-1",
                "state": "output-available",
                "input": {"url": "/traces"},
                "output": {"ok": True},
                "callProviderMetadata": call_provider_metadata,
            }
        ],
    }


def _message_with_phoenix_metadata(phoenix_metadata: dict[str, Any]) -> dict[str, Any]:
    return _message_with_call_provider_metadata({"phoenix": phoenix_metadata})


def _call_provider_metadata(message: PhoenixUIMessage) -> dict[str, Any]:
    """Return the sole part's ``callProviderMetadata``, narrowed to a plain dict."""
    metadata = getattr(message.parts[0], "call_provider_metadata", None)
    assert isinstance(metadata, dict)
    return metadata


def test_valid_client_metadata_is_accepted_without_coercion() -> None:
    submitted_phoenix_metadata = {
        "toolExecutionEnvironment": "client",
        "toolInputEmittedAt": "2026-07-10T12:00:00Z",
        "clientStartedAt": "2026-07-10T12:00:01Z",
        "clientEndedAt": "2026-07-10T12:00:02Z",
    }
    message = PhoenixUIMessage.model_validate(
        _message_with_phoenix_metadata(submitted_phoenix_metadata)
    )
    uncoerced_phoenix_metadata = _call_provider_metadata(message)["phoenix"]
    assert isinstance(uncoerced_phoenix_metadata, dict)
    assert uncoerced_phoenix_metadata == submitted_phoenix_metadata


def test_server_stamped_metadata_without_client_timings_is_accepted() -> None:
    message = PhoenixUIMessage.model_validate(
        _message_with_phoenix_metadata({"toolExecutionEnvironment": "server"})
    )
    assert _call_provider_metadata(message)["phoenix"] == {"toolExecutionEnvironment": "server"}


def test_missing_execution_environment_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_phoenix_metadata({"toolInputEmittedAt": "2026-07-10T12:00:00Z"})
        )


def test_unknown_field_in_phoenix_namespace_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_phoenix_metadata(
                {"toolExecutionEnvironment": "client", "bogusField": True}
            )
        )


def test_invalid_execution_environment_value_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_phoenix_metadata({"toolExecutionEnvironment": "browser"})
        )


def test_non_phoenix_provider_namespace_is_left_untouched() -> None:
    message = PhoenixUIMessage.model_validate(
        _message_with_call_provider_metadata(
            {
                "phoenix": {"toolExecutionEnvironment": "client"},
                "openai": {"cachedTokens": 10},
            }
        )
    )
    assert _call_provider_metadata(message)["openai"] == {"cachedTokens": 10}


def test_tool_part_without_phoenix_namespace_passes() -> None:
    message = PhoenixUIMessage.model_validate(
        _message_with_call_provider_metadata({"openai": {"cachedTokens": 10}})
    )
    assert "phoenix" not in _call_provider_metadata(message)


def test_message_without_tool_metadata_passes() -> None:
    message = PhoenixUIMessage.model_validate(
        {
            "id": "assistant-1",
            "role": "assistant",
            "parts": [{"type": "text", "text": "hello"}],
        }
    )
    part = message.parts[0]
    assert isinstance(part, TextUIPart)
    assert part.text == "hello"


def test_phoenix_ui_message_adapter_rejects_invalid_metadata() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessageAdapter.validate_python(
            _message_with_phoenix_metadata({"toolExecutionEnvironment": "browser"})
        )
