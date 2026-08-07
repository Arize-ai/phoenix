from typing import Any, Literal

import pytest
from pydantic import ValidationError

from phoenix.db.types.data_stream_protocol import (
    AssistantMessageMetadata,
    FileUIPart,
    MessageMetadata,
    PhoenixUIMessage,
    PhoenixUIMessageAdapter,
    ProviderMetadata,
    ReasoningUIPart,
    TextUIPart,
    ToolOutputAvailablePart,
    UIMessagePart,
    UserMessageMetadata,
)


def _assistant_message(*parts: UIMessagePart) -> PhoenixUIMessage:
    return PhoenixUIMessage(id="assistant-1", role="assistant", parts=list(parts))


def _tool_part(call_provider_metadata: ProviderMetadata) -> ToolOutputAvailablePart:
    """A resolved tool part carrying the given ``callProviderMetadata``."""
    return ToolOutputAvailablePart(
        type="tool-open_page",
        tool_call_id="call-1",
        state="output-available",
        input={"url": "/traces"},
        output={"ok": True},
        call_provider_metadata=call_provider_metadata,
    )


def _reasoning_part(provider_metadata: ProviderMetadata) -> ReasoningUIPart:
    return ReasoningUIPart(
        type="reasoning", text="thinking...", state="done", provider_metadata=provider_metadata
    )


def _text_part(provider_metadata: ProviderMetadata) -> TextUIPart:
    return TextUIPart(type="text", text="hello", state="done", provider_metadata=provider_metadata)


def _call_provider_metadata(message: PhoenixUIMessage) -> dict[str, Any]:
    """Return the sole part's ``callProviderMetadata``, narrowed to a plain dict."""
    part = message.parts[0]
    assert isinstance(part, ToolOutputAvailablePart)
    assert part.call_provider_metadata is not None
    return part.call_provider_metadata


def test_valid_client_metadata_is_accepted_without_coercion() -> None:
    submitted_phoenix_metadata = {
        "toolExecutionEnvironment": "client",
        "toolInputEmittedAt": "2026-07-10T12:00:00Z",
        "clientStartedAt": "2026-07-10T12:00:01Z",
        "clientEndedAt": "2026-07-10T12:00:02Z",
    }
    message = _assistant_message(_tool_part({"phoenix": submitted_phoenix_metadata}))
    uncoerced_phoenix_metadata = _call_provider_metadata(message)["phoenix"]
    assert isinstance(uncoerced_phoenix_metadata, dict)
    assert uncoerced_phoenix_metadata == submitted_phoenix_metadata


def test_server_stamped_metadata_without_client_timings_is_accepted() -> None:
    message = _assistant_message(_tool_part({"phoenix": {"toolExecutionEnvironment": "server"}}))
    assert _call_provider_metadata(message)["phoenix"] == {"toolExecutionEnvironment": "server"}


def test_missing_execution_environment_raises() -> None:
    with pytest.raises(ValidationError):
        _assistant_message(_tool_part({"phoenix": {"toolInputEmittedAt": "2026-07-10T12:00:00Z"}}))


def test_unknown_field_in_phoenix_namespace_raises() -> None:
    with pytest.raises(ValidationError):
        _assistant_message(
            _tool_part({"phoenix": {"toolExecutionEnvironment": "client", "bogusField": True}})
        )


def test_invalid_execution_environment_value_raises() -> None:
    with pytest.raises(ValidationError):
        _assistant_message(_tool_part({"phoenix": {"toolExecutionEnvironment": "browser"}}))


def test_non_phoenix_provider_namespace_is_left_untouched() -> None:
    message = _assistant_message(
        _tool_part(
            {
                "phoenix": {"toolExecutionEnvironment": "client"},
                "openai": {"cachedTokens": 10},
            }
        )
    )
    assert _call_provider_metadata(message)["openai"] == {"cachedTokens": 10}


def test_tool_part_without_phoenix_namespace_passes() -> None:
    message = _assistant_message(_tool_part({"openai": {"cachedTokens": 10}}))
    assert "phoenix" not in _call_provider_metadata(message)


def test_phoenix_namespace_in_result_provider_metadata_raises() -> None:
    """Phoenix only stamps ``callProviderMetadata``; there is no result-side schema."""
    with pytest.raises(ValidationError, match="no schema"):
        _assistant_message(
            ToolOutputAvailablePart(
                type="tool-open_page",
                tool_call_id="call-1",
                state="output-available",
                input={"url": "/traces"},
                output={"ok": True},
                result_provider_metadata={"phoenix": {"anything": True}},
            )
        )


def test_phoenix_namespace_on_a_text_part_raises() -> None:
    with pytest.raises(ValidationError, match="no schema"):
        _assistant_message(_text_part({"phoenix": {"anything": True}}))


def test_phoenix_namespace_on_a_file_part_raises() -> None:
    with pytest.raises(ValidationError, match="no schema"):
        _assistant_message(
            FileUIPart(
                type="file",
                url="data:text/plain;base64,aGk=",
                media_type="text/plain",
                provider_metadata={"phoenix": {"anything": True}},
            )
        )


_REASONING_PYDANTIC_AI_METADATA: dict[str, Any] = {
    "id": "think_1",
    "signature": "sig==",
    "provider_name": "anthropic",
    "provider_details": {"k": "v"},
}


def test_reasoning_pydantic_ai_metadata_is_accepted_without_coercion() -> None:
    message = _assistant_message(_reasoning_part({"pydantic_ai": _REASONING_PYDANTIC_AI_METADATA}))
    part = message.parts[0]
    assert isinstance(part, ReasoningUIPart)
    assert part.provider_metadata == {"pydantic_ai": _REASONING_PYDANTIC_AI_METADATA}


def test_text_pydantic_ai_metadata_is_accepted() -> None:
    _assistant_message(
        _text_part(
            {"pydantic_ai": {"id": "txt_1", "provider_name": "anthropic", "provider_details": {}}}
        )
    )


def test_signature_on_a_text_part_raises() -> None:
    """``signature`` is a reasoning-part key; on text it has no consumer."""
    with pytest.raises(ValidationError):
        _assistant_message(_text_part({"pydantic_ai": {"signature": "sig=="}}))


def test_unknown_key_in_pydantic_ai_namespace_raises() -> None:
    with pytest.raises(ValidationError):
        _assistant_message(_reasoning_part({"pydantic_ai": {"signature": "sig==", "bogus_key": 1}}))


def test_wrong_typed_signature_raises() -> None:
    with pytest.raises(ValidationError):
        _assistant_message(_reasoning_part({"pydantic_ai": {"signature": 123}}))


def test_tool_pydantic_ai_metadata_is_accepted() -> None:
    _assistant_message(
        _tool_part(
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
        _assistant_message(_tool_part({"pydantic_ai": {"tool_kind": "bogus"}}))


def test_non_interrupted_outcome_raises() -> None:
    """``interrupted`` is the only outcome that ever rides the metadata
    channel; the others have dedicated part states."""
    with pytest.raises(ValidationError):
        _assistant_message(_tool_part({"pydantic_ai": {"outcome": "success"}}))


def test_pydantic_ai_namespace_on_an_untyped_part_family_raises() -> None:
    with pytest.raises(ValidationError, match="no schema"):
        _assistant_message(
            FileUIPart(
                type="file",
                url="data:text/plain;base64,aGk=",
                media_type="text/plain",
                provider_metadata={"pydantic_ai": {"file_id": "f_1"}},
            )
        )


def test_non_pydantic_ai_namespace_on_reasoning_part_is_left_untouched() -> None:
    message = _assistant_message(_reasoning_part({"anthropic": {"redacted": True}}))
    part = message.parts[0]
    assert isinstance(part, ReasoningUIPart)
    assert part.provider_metadata == {"anthropic": {"redacted": True}}


def test_message_without_tool_metadata_passes() -> None:
    message = _assistant_message(TextUIPart(type="text", text="hello"))
    part = message.parts[0]
    assert isinstance(part, TextUIPart)
    assert part.text == "hello"


_USER_METADATA = UserMessageMetadata(
    type="user",
    current_date_time="2026-07-10T12:00:00Z",
    time_zone="America/Los_Angeles",
)
_ASSISTANT_METADATA = AssistantMessageMetadata(type="assistant", session_id="session-1")


def _message_with_metadata(
    role: Literal["system", "user", "assistant"],
    metadata: MessageMetadata,
) -> PhoenixUIMessage:
    return PhoenixUIMessage(
        id=f"{role}-1",
        role=role,
        parts=[TextUIPart(type="text", text="hello")],
        metadata=metadata,
    )


def test_user_message_with_user_metadata_passes() -> None:
    _message_with_metadata("user", _USER_METADATA)


def test_unknown_key_in_assistant_metadata_raises() -> None:
    with pytest.raises(ValidationError):
        AssistantMessageMetadata.model_validate(
            {"type": "assistant", "sessionId": "session-1", "bogusKey": True}
        )


def test_unknown_key_in_user_metadata_raises() -> None:
    with pytest.raises(ValidationError):
        UserMessageMetadata.model_validate(
            {
                "type": "user",
                "currentDateTime": "2026-07-10T12:00:00Z",
                "timeZone": "UTC",
                "bogusKey": True,
            }
        )


def test_assistant_message_with_assistant_metadata_passes() -> None:
    _message_with_metadata("assistant", _ASSISTANT_METADATA)


def test_user_message_with_assistant_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="user-role message cannot carry assistant metadata"):
        _message_with_metadata("user", _ASSISTANT_METADATA)


def test_assistant_message_with_user_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="assistant-role message cannot carry user metadata"):
        _message_with_metadata("assistant", _USER_METADATA)


def test_system_message_with_metadata_raises() -> None:
    with pytest.raises(ValidationError, match="system-role message cannot carry user metadata"):
        _message_with_metadata("system", _USER_METADATA)


def test_phoenix_ui_message_adapter_rejects_invalid_metadata() -> None:
    """The adapter validates raw wire input, so the payload stays a dict here."""
    with pytest.raises(ValidationError):
        PhoenixUIMessageAdapter.validate_python(
            {
                "id": "assistant-1",
                "role": "assistant",
                "parts": [
                    {
                        "type": "tool-open_page",
                        "toolCallId": "call-1",
                        "state": "output-available",
                        "input": {"url": "/traces"},
                        "output": {"ok": True},
                        "callProviderMetadata": {
                            "phoenix": {"toolExecutionEnvironment": "browser"}
                        },
                    }
                ],
            }
        )
