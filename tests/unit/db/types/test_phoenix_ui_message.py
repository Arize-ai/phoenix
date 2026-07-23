from typing import Any, cast

import pytest
from pydantic import ValidationError
from sqlalchemy.engine import Dialect

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    PhoenixUIMessageAdapter,
    UITextPart,
)

_TOOL_STATES = (
    "input-streaming",
    "input-available",
    "approval-requested",
    "approval-responded",
    "output-available",
    "output-error",
    "output-denied",
)


def _representative_persisted_message() -> dict[str, Any]:
    parts: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": "answer",
            "state": "done",
            "providerMetadata": {"openai": {"itemId": "item-1"}},
        },
        {"type": "reasoning", "text": "thinking", "state": "done"},
        {
            "type": "custom",
            "kind": "provider-event",
            "providerMetadata": {"openai": {"opaque": True}},
        },
        {
            "type": "tool-invocation",
            "toolInvocationId": "legacy-call",
            "toolName": "legacy",
            "args": {"query": "latency"},
            "state": "output-available",
            "result": {"rows": 1},
            "providerExecuted": True,
        },
        {"type": "step-start"},
        {
            "type": "file",
            "mediaType": "text/plain",
            "url": "data:text/plain;base64,aGk=",
            "filename": "answer.txt",
            "providerReference": {"id": "file-1"},
        },
        {
            "type": "reasoning-file",
            "mediaType": "application/json",
            "url": "data:application/json;base64,e30=",
        },
        {
            "type": "source-url",
            "sourceId": "source-url-1",
            "url": "https://example.com",
            "title": "Example",
        },
        {
            "type": "source-document",
            "sourceId": "source-document-1",
            "mediaType": "text/plain",
            "title": "Document",
            "filename": "document.txt",
        },
        {
            "type": "data-progress",
            "id": "data-1",
            "data": {"percent": 100},
            "transient": False,
        },
    ]
    for index, state in enumerate(_TOOL_STATES):
        part: dict[str, Any] = {
            "type": "tool-lookup",
            "toolCallId": f"static-{index}",
            "state": state,
            "input": ["arbitrary", index],
        }
        if state in ("approval-requested", "approval-responded", "output-denied"):
            part["approval"] = {
                "id": f"approval-{index}",
                "approved": False if state == "output-denied" else state == "approval-responded",
                "reason": "not allowed" if state == "output-denied" else "approved",
                "isAutomatic": state == "approval-requested",
            }
        if state == "output-available":
            part.update(
                {
                    "output": {"rows": 3},
                    "resultProviderMetadata": {"openai": {"itemId": "result-1"}},
                    "toolMetadata": {"display": "table"},
                    "preliminary": True,
                    "title": "Lookup",
                }
            )
        if state == "output-error":
            part.update({"rawInput": "bad", "errorText": "lookup failed"})
        parts.append(part)

        dynamic_part = dict(part)
        dynamic_part.update(
            {
                "type": "dynamic-tool",
                "toolName": "lookup",
                "toolCallId": f"dynamic-{index}",
            }
        )
        parts.append(dynamic_part)

    return {
        "id": "assistant-1",
        "role": "assistant",
        "metadata": {"type": "assistant", "sessionId": "session-1"},
        "parts": parts,
    }


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
    assert isinstance(part, UITextPart)
    assert part.text == "hello"


def test_phoenix_ui_message_adapter_rejects_invalid_metadata() -> None:
    with pytest.raises(ValidationError):
        PhoenixUIMessageAdapter.validate_python(
            _message_with_phoenix_metadata({"toolExecutionEnvironment": "browser"})
        )


def test_representative_message_round_trips_through_database_type() -> None:
    persisted = _representative_persisted_message()
    message = PhoenixUIMessageAdapter.validate_python(persisted)
    database_type = models._UIMessage()
    dialect = cast(Dialect, None)

    bound = database_type.process_bind_param(message, dialect)
    assert bound == persisted
    assert database_type.process_result_value(bound, dialect) == message


def test_existing_v6_persisted_row_remains_compatible() -> None:
    persisted = {
        "id": "assistant-existing",
        "role": "assistant",
        "metadata": {"type": "assistant", "sessionId": "session-existing"},
        "parts": [
            {"type": "step-start"},
            {"type": "text", "text": "existing answer", "state": "done"},
            {
                "type": "tool-search",
                "toolCallId": "call-existing",
                "state": "output-error",
                "input": {"query": "latency"},
                "rawInput": "{bad json",
                "errorText": "invalid input",
                "callProviderMetadata": {"phoenix": {"toolExecutionEnvironment": "server"}},
            },
        ],
    }

    message = PhoenixUIMessageAdapter.validate_python(persisted)
    assert message.model_dump(mode="json", by_alias=True, exclude_none=True) == persisted
