from typing import Any

import pytest
from pydantic_ai.messages import (
    BinaryContent,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from phoenix.server.agents.summarization import (
    MAX_SUMMARIZED_TOOL_RESULT_LENGTH,
    summarize_messages,
    summarize_messages_for_compaction,
)

CHECKPOINT: dict[str, Any] = {
    "objectives": ["Investigate the trace"],
    "constraints_and_preferences": [],
    "decisions": [],
    "completed_work": [],
    "active_work": [],
    "blockers": [],
    "next_steps": [],
    "important_details": [],
}


def _tool_result(content: Any) -> ModelRequest:
    return ModelRequest(
        parts=[ToolReturnPart(tool_name="get_spans", content=content, tool_call_id="call-1")]
    )


def _recording_model(
    seen: list[ModelMessage],
    *,
    tool_name: str,
    args: Any,
) -> FunctionModel:
    def function(messages: list[ModelMessage], agent_info: AgentInfo) -> ModelResponse:
        seen.extend(messages)
        return ModelResponse(parts=[ToolCallPart(tool_name=tool_name, args=args)])

    return FunctionModel(function=function)


def _sent_tool_results(seen: list[ModelMessage]) -> list[ToolReturnPart]:
    return [part for message in seen for part in message.parts if isinstance(part, ToolReturnPart)]


async def test_compaction_truncates_oversized_tool_results() -> None:
    seen: list[ModelMessage] = []
    content = "x" * (MAX_SUMMARIZED_TOOL_RESULT_LENGTH + 500)
    messages: list[ModelMessage] = [_tool_result(content)]

    await summarize_messages_for_compaction(
        messages=messages,
        model=_recording_model(seen, tool_name="conversation_checkpoint", args=CHECKPOINT),
    )

    (sent,) = _sent_tool_results(seen)
    assert sent.content == (
        "x" * MAX_SUMMARIZED_TOOL_RESULT_LENGTH
        + "\n[... 500 characters truncated for summarization]"
    )
    # the caller's messages are left untouched
    assert isinstance(messages[0].parts[0], ToolReturnPart)
    assert messages[0].parts[0].content == content


async def test_summarization_truncates_oversized_tool_results() -> None:
    seen: list[ModelMessage] = []
    messages: list[ModelMessage] = [_tool_result("x" * (MAX_SUMMARIZED_TOOL_RESULT_LENGTH + 1))]

    await summarize_messages(
        messages=messages,
        model=_recording_model(seen, tool_name="summary", args={"summary": "Trace triage"}),
    )

    (sent,) = _sent_tool_results(seen)
    assert isinstance(sent.content, str)
    assert sent.content.endswith("[... 1 characters truncated for summarization]")


@pytest.mark.parametrize(
    "content",
    [
        pytest.param("x" * MAX_SUMMARIZED_TOOL_RESULT_LENGTH, id="text-at-the-limit"),
        pytest.param({"spans": ["a", "b"]}, id="structured-content"),
        pytest.param(["a", "b"], id="list-content"),
    ],
)
async def test_tool_results_within_the_limit_are_passed_through_unchanged(content: Any) -> None:
    seen: list[ModelMessage] = []
    messages: list[ModelMessage] = [_tool_result(content)]

    await summarize_messages_for_compaction(
        messages=messages,
        model=_recording_model(seen, tool_name="conversation_checkpoint", args=CHECKPOINT),
    )

    (sent,) = _sent_tool_results(seen)
    assert sent.content == content


async def test_oversized_structured_tool_results_are_truncated_as_json() -> None:
    seen: list[ModelMessage] = []
    messages: list[ModelMessage] = [
        _tool_result({"spans": ["x" * MAX_SUMMARIZED_TOOL_RESULT_LENGTH]})
    ]

    await summarize_messages_for_compaction(
        messages=messages,
        model=_recording_model(seen, tool_name="conversation_checkpoint", args=CHECKPOINT),
    )

    (sent,) = _sent_tool_results(seen)
    assert isinstance(sent.content, str)
    assert sent.content.startswith('{"spans":["xxx')
    assert sent.content.endswith("characters truncated for summarization]")


async def test_truncation_keeps_multimodal_files_and_other_parts() -> None:
    seen: list[ModelMessage] = []
    image = BinaryContent(data=b"png-bytes", media_type="image/png")
    messages: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="Find the slow span")]),
        ModelResponse(parts=[TextPart(content="Looking now")]),
        _tool_result(["x" * (MAX_SUMMARIZED_TOOL_RESULT_LENGTH + 10), image]),
    ]

    await summarize_messages_for_compaction(
        messages=messages,
        model=_recording_model(seen, tool_name="conversation_checkpoint", args=CHECKPOINT),
    )

    (sent,) = _sent_tool_results(seen)
    assert isinstance(sent.content, list)
    truncated, kept_image = sent.content
    assert isinstance(truncated, str)
    assert truncated.endswith("characters truncated for summarization]")
    assert kept_image == image
    # untouched messages are forwarded as-is
    assert seen[0] is messages[0]
    assert seen[1] is messages[1]
