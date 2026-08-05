"""Round-trip behavior of the ``agent_session_messages.message`` column type.

The column stores a ``PhoenixUIMessage`` as JSON. The bind must preserve the
exact validated wire shape — in particular explicit nulls on required ``Any``
fields, which are legal on the wire but would fail re-validation if the dump
dropped their keys — and must reject any message that does not survive its own
JSON representation, since such a row would break every subsequent read of the
session's transcript.
"""

from typing import Any

import pytest
from pydantic import ValidationError

from phoenix.db.models import _PhoenixUIMessage
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessageAdapter,
    TextUIPart,
    ToolOutputDeniedPart,
    UserMessageMetadata,
)
from phoenix.db.types.data_stream_protocol.phoenix_types import PhoenixUIMessage

_MESSAGE_ID = "3f2f9d9e-1234-4abc-8def-1234567890ab"


def _round_trip(raw: dict[str, Any]) -> None:
    """Assert a wire payload survives bind → stored JSON → result unchanged."""
    column_type = _PhoenixUIMessage()
    message = PhoenixUIMessageAdapter.validate_python(raw)
    stored = column_type.process_bind_param(message, None)  # type: ignore[arg-type]
    assert stored == raw
    loaded = column_type.process_result_value(stored, None)  # type: ignore[arg-type]
    assert loaded == message


def test_explicit_null_on_required_any_field_round_trips() -> None:
    # ``output`` is required on a resolved dynamic tool part, so dropping the
    # key (as an exclude_none dump would) makes the stored JSON unreadable.
    _round_trip(
        {
            "id": _MESSAGE_ID,
            "role": "assistant",
            "parts": [
                {
                    "type": "dynamic-tool",
                    "toolName": "search",
                    "toolCallId": "call_1",
                    "state": "output-available",
                    "input": {"query": "q"},
                    "output": None,
                }
            ],
        }
    )


def test_absent_optional_fields_stay_absent() -> None:
    _round_trip(
        {
            "id": _MESSAGE_ID,
            "role": "user",
            "metadata": {
                "type": "user",
                "currentDateTime": "2026-08-05T00:00:00+00:00",
                "timeZone": "UTC",
            },
            "parts": [{"type": "text", "text": "hello"}],
        }
    )


def test_server_built_compaction_message_round_trips() -> None:
    message = PhoenixUIMessage(
        id=_MESSAGE_ID,
        role="user",
        metadata=UserMessageMetadata(
            type="user",
            current_date_time="2026-08-05T00:00:00+00:00",
            time_zone="UTC",
            is_compaction_message=True,
        ),
        parts=[TextUIPart(type="text", text="summary")],
    )
    column_type = _PhoenixUIMessage()
    stored = column_type.process_bind_param(message, None)  # type: ignore[arg-type]
    assert stored is not None
    assert stored["metadata"]["isCompactionMessage"] is True
    assert column_type.process_result_value(stored, None) == message  # type: ignore[arg-type]


def test_message_that_cannot_round_trip_is_rejected_at_write() -> None:
    # The vendored tool parts default their ``state`` discriminator, so an
    # unset ``state`` is dropped by the exclude_unset dump and the stored part
    # would re-validate as a different member of the tool-part union.
    message = PhoenixUIMessage(
        id=_MESSAGE_ID,
        role="assistant",
        parts=[ToolOutputDeniedPart(type="tool-search", tool_call_id="call_1")],
    )
    with pytest.raises(Exception, match="round-trip"):
        _PhoenixUIMessage().process_bind_param(message, None)  # type: ignore[arg-type]


def test_metadata_discriminator_is_required_at_construction() -> None:
    # The Phoenix-owned metadata types drop upstream's ergonomic ``type``
    # default so a forgotten discriminator fails here instead of at persist.
    with pytest.raises(ValidationError, match="type"):
        UserMessageMetadata(
            current_date_time="2026-08-05T00:00:00+00:00",
            time_zone="UTC",
        )


def test_none_binds_and_loads_as_none() -> None:
    column_type = _PhoenixUIMessage()
    assert column_type.process_bind_param(None, None) is None  # type: ignore[arg-type]
    assert column_type.process_result_value(None, None) is None  # type: ignore[arg-type]
