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


def _message_with_part(part: dict[str, Any]) -> dict[str, Any]:
    return {"id": "assistant-1", "role": "assistant", "parts": [part]}


def _reasoning_part(pydantic_ai_metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "reasoning",
        "text": "thinking...",
        "state": "done",
        "providerMetadata": {"pydantic_ai": pydantic_ai_metadata},
    }


def _text_part(pydantic_ai_metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "text",
        "text": "hello",
        "state": "done",
        "providerMetadata": {"pydantic_ai": pydantic_ai_metadata},
    }


_REASONING_PYDANTIC_AI_METADATA: dict[str, Any] = {
    "id": "think_1",
    "signature": "sig==",
    "provider_name": "anthropic",
    "provider_details": {"k": "v"},
}


def test_reasoning_pydantic_ai_metadata_is_accepted_without_coercion() -> None:
    message = PhoenixUIMessage.model_validate(
        _message_with_part(_reasoning_part(_REASONING_PYDANTIC_AI_METADATA))
    )
    part = message.parts[0]
    assert getattr(part, "provider_metadata") == {"pydantic_ai": _REASONING_PYDANTIC_AI_METADATA}


def test_text_pydantic_ai_metadata_is_accepted() -> None:
    PhoenixUIMessage.model_validate(
        _message_with_part(
            _text_part({"id": "txt_1", "provider_name": "anthropic", "provider_details": {}})
        )
    )


def test_signature_on_a_text_part_raises() -> None:
    """``signature`` is a reasoning-part key; on text it has no consumer."""
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(_message_with_part(_text_part({"signature": "sig=="})))


def test_unknown_key_in_pydantic_ai_namespace_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_part(_reasoning_part({"signature": "sig==", "bogus_key": 1}))
        )


def test_wrong_typed_signature_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(_message_with_part(_reasoning_part({"signature": 123})))


def test_tool_pydantic_ai_metadata_is_accepted() -> None:
    PhoenixUIMessage.model_validate(
        _message_with_call_provider_metadata(
            {
                "pydantic_ai": {
                    "id": "toolu_1",
                    "provider_name": "anthropic",
                    "tool_kind": "tool-search",
                    "outcome": "interrupted",
                }
            }
        )
    )


def test_unknown_tool_kind_raises() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_call_provider_metadata({"pydantic_ai": {"tool_kind": "bogus"}})
        )


def test_non_interrupted_outcome_raises() -> None:
    """``interrupted`` is the only outcome that ever rides the metadata
    channel; the others have dedicated part states."""
    with pytest.raises(ValidationError):
        PhoenixUIMessage.model_validate(
            _message_with_call_provider_metadata({"pydantic_ai": {"outcome": "success"}})
        )


def test_pydantic_ai_namespace_on_an_untyped_part_family_raises() -> None:
    with pytest.raises(ValidationError, match="no schema"):
        PhoenixUIMessage.model_validate(
            _message_with_part(
                {
                    "type": "file",
                    "url": "data:text/plain;base64,aGk=",
                    "mediaType": "text/plain",
                    "providerMetadata": {"pydantic_ai": {"file_id": "f_1"}},
                }
            )
        )


def test_non_pydantic_ai_namespace_on_reasoning_part_is_left_untouched() -> None:
    message = PhoenixUIMessage.model_validate(
        _message_with_part(
            {
                "type": "reasoning",
                "text": "thinking...",
                "state": "done",
                "providerMetadata": {"anthropic": {"redacted": True}},
            }
        )
    )
    assert getattr(message.parts[0], "provider_metadata") == {"anthropic": {"redacted": True}}


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


_USER_METADATA: dict[str, Any] = {
    "type": "user",
    "currentDateTime": "2026-07-10T12:00:00Z",
    "timeZone": "America/Los_Angeles",
}
_ASSISTANT_METADATA: dict[str, Any] = {"type": "assistant", "sessionId": "session-1"}


def _message_with_metadata(role: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"{role}-1",
        "role": role,
        "parts": [{"type": "text", "text": "hello"}],
        "metadata": metadata,
    }


def test_user_message_with_user_metadata_passes() -> None:
    PhoenixUIMessage.model_validate(_message_with_metadata("user", _USER_METADATA))


def test_assistant_message_with_assistant_metadata_passes() -> None:
    PhoenixUIMessage.model_validate(_message_with_metadata("assistant", _ASSISTANT_METADATA))


def test_user_message_with_assistant_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="user-role message cannot carry assistant metadata"):
        PhoenixUIMessage.model_validate(_message_with_metadata("user", _ASSISTANT_METADATA))


def test_assistant_message_with_user_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="assistant-role message cannot carry user metadata"):
        PhoenixUIMessage.model_validate(_message_with_metadata("assistant", _USER_METADATA))


def test_system_message_with_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="system-role message cannot carry user metadata"):
        PhoenixUIMessage.model_validate(_message_with_metadata("system", _USER_METADATA))


def test_phoenix_ui_message_adapter_rejects_invalid_metadata() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessageAdapter.validate_python(
            _message_with_phoenix_metadata({"toolExecutionEnvironment": "browser"})
        )
