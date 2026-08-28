"""Tests for Phoenix-specific extensions to the UI-message stream port."""

from phoenix.db.types.data_stream_protocol import (
    ReasoningUIPart,
    StepStartUIPart,
    TextUIPart,
    ToolInputStreamingPart,
)
from phoenix.server.agents.ui_message_stream import finalize_interrupted_ui_message_state
from phoenix.server.agents.vercel_ui_message_stream import (
    PartialToolCall,
    create_streaming_ui_message_state,
)


def test_finalize_interrupted_state_marks_streaming_parts_done() -> None:
    state = create_streaming_ui_message_state(message_id="m-1", last_message=None)
    text_part = TextUIPart(type="text", text="partial answer", state="streaming")
    reasoning_part = ReasoningUIPart(type="reasoning", text="thinking", state="streaming")
    state.message.parts.extend([StepStartUIPart(type="step-start"), reasoning_part, text_part])
    state.active_text_parts["t-1"] = text_part
    state.active_reasoning_parts["r-1"] = reasoning_part

    finalize_interrupted_ui_message_state(state)

    assert text_part.state == "done"
    assert text_part.text == "partial answer"
    assert reasoning_part.state == "done"
    assert not state.active_text_parts
    assert not state.active_reasoning_parts
    # The leading step-start is kept: content follows it.
    assert [type(part) for part in state.message.parts] == [
        StepStartUIPart,
        ReasoningUIPart,
        TextUIPart,
    ]


def test_finalize_interrupted_state_drops_empty_parts_and_trailing_step_start() -> None:
    state = create_streaming_ui_message_state(message_id="m-1", last_message=None)
    done_text_part = TextUIPart(type="text", text="finished earlier", state="done")
    empty_text_part = TextUIPart(type="text", text="", state="streaming")
    empty_reasoning_part = ReasoningUIPart(type="reasoning", text="", state="streaming")
    state.message.parts.extend(
        [
            StepStartUIPart(type="step-start"),
            done_text_part,
            StepStartUIPart(type="step-start"),
            empty_reasoning_part,
            empty_text_part,
        ]
    )
    state.active_text_parts["t-1"] = empty_text_part
    state.active_reasoning_parts["r-1"] = empty_reasoning_part

    finalize_interrupted_ui_message_state(state)

    # Parts that never received text vanish, along with the now-trailing
    # step-start marker that has no content after it.
    assert state.message.parts == [StepStartUIPart(type="step-start"), done_text_part]


def test_finalize_interrupted_state_leaves_tool_parts_for_the_caller() -> None:
    state = create_streaming_ui_message_state(message_id="m-1", last_message=None)
    tool_part = ToolInputStreamingPart(
        type="tool-bash",
        tool_call_id="call-1",
        state="input-streaming",
        input=None,
    )
    state.message.parts.append(tool_part)
    state.partial_tool_calls["call-1"] = PartialToolCall(text='{"comm', tool_name="bash")

    finalize_interrupted_ui_message_state(state)

    # Unresolved tool parts are the route's job to resolve as interrupted.
    assert state.message.parts == [tool_part]
    assert tool_part.state == "input-streaming"
    assert not state.partial_tool_calls


def test_finalize_interrupted_state_is_idempotent() -> None:
    state = create_streaming_ui_message_state(message_id="m-1", last_message=None)
    text_part = TextUIPart(type="text", text="kept", state="streaming")
    state.message.parts.append(text_part)
    state.active_text_parts["t-1"] = text_part

    finalize_interrupted_ui_message_state(state)
    finalize_interrupted_ui_message_state(state)

    assert state.message.parts == [text_part]
    assert text_part.state == "done"
