from __future__ import annotations

from pydantic_ai.messages import ToolCallPart, ToolReturnPart
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    TextUIPart,
    ToolApprovalRequested,
    ToolApprovalRequestedPart,
    ToolInputAvailablePart,
    ToolInputStreamingPart,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    UIMessage,
)

from phoenix.server.agents.interrupted_tool_calls import resolve_unresolved_tool_calls


def _user_message(text: str) -> UIMessage:
    return UIMessage(id="u1", role="user", parts=[TextUIPart(type="text", text=text)])


def _assistant_message(*parts: object) -> UIMessage:
    return UIMessage(id="a1", role="assistant", parts=list(parts))  # type: ignore[arg-type]


class TestResolveUnresolvedToolCalls:
    def test_non_assistant_messages_are_untouched(self) -> None:
        messages = [_user_message("hi")]
        result = resolve_unresolved_tool_calls(messages)
        assert result == messages
        assert result[0] is messages[0]

    def test_assistant_message_without_tool_parts_is_untouched(self) -> None:
        message = _assistant_message(TextUIPart(type="text", text="hello"))
        result = resolve_unresolved_tool_calls([message])
        assert result[0] is message

    def test_resolved_tool_part_is_untouched(self) -> None:
        message = _assistant_message(
            ToolOutputAvailablePart(
                type="tool-search",
                tool_call_id="call1",
                input={"query": "x"},
                output="result",
            )
        )
        result = resolve_unresolved_tool_calls([message])
        assert result[0] is message

    def test_approval_requested_part_is_untouched(self) -> None:
        # Deferred approval is a distinct, still-resolvable state (see the
        # `deferred_tool_results` flow) and must not be treated as dangling.
        part = ToolApprovalRequestedPart(
            type="tool-run_code",
            tool_call_id="call1",
            input={"code": "print(1)"},
            approval=ToolApprovalRequested(id="call1"),
        )
        message = _assistant_message(part)
        result = resolve_unresolved_tool_calls([message])
        assert result[0].parts[0] is part

    def test_input_available_part_becomes_output_error(self) -> None:
        message = _assistant_message(
            ToolInputAvailablePart(
                type="tool-run_code",
                tool_call_id="call1",
                input={"code": "print(1)"},
                call_provider_metadata={"phoenix": {"tool_execution_environment": "client"}},
            )
        )
        result = resolve_unresolved_tool_calls([message])
        part = result[0].parts[0]
        assert isinstance(part, ToolOutputErrorPart)
        assert part.tool_call_id == "call1"
        assert part.input == {"code": "print(1)"}
        assert "client" in part.error_text

    def test_input_streaming_part_becomes_output_error(self) -> None:
        message = _assistant_message(
            ToolInputStreamingPart(type="tool-run_code", tool_call_id="call1")
        )
        result = resolve_unresolved_tool_calls([message])
        part = result[0].parts[0]
        assert isinstance(part, ToolOutputErrorPart)
        assert part.tool_call_id == "call1"

    def test_missing_execution_environment_reads_as_unknown(self) -> None:
        message = _assistant_message(
            ToolInputAvailablePart(type="tool-run_code", tool_call_id="call1")
        )
        result = resolve_unresolved_tool_calls([message])
        part = result[0].parts[0]
        assert isinstance(part, ToolOutputErrorPart)
        assert "unknown" in part.error_text

    def test_only_dangling_parts_in_a_mixed_message_are_replaced(self) -> None:
        resolved_part = ToolOutputAvailablePart(
            type="tool-search", tool_call_id="call1", input={}, output="ok"
        )
        dangling_part = ToolInputAvailablePart(type="tool-run_code", tool_call_id="call2")
        message = _assistant_message(resolved_part, dangling_part)
        result = resolve_unresolved_tool_calls([message])
        parts = result[0].parts
        assert parts[0] is resolved_part
        assert isinstance(parts[1], ToolOutputErrorPart)

    def test_unresolved_call_adapts_to_a_valid_pydantic_ai_history(self) -> None:
        # This is the regression this module exists for: without resolution,
        # `load_messages` emits a bare `ToolCallPart` with no `ToolReturnPart`,
        # which providers like Anthropic reject on the next turn.
        message = _assistant_message(
            ToolInputAvailablePart(type="tool-run_code", tool_call_id="call1", input={"code": "1"})
        )
        history = VercelAIAdapter.load_messages(resolve_unresolved_tool_calls([message]))
        parts = [part for msg in history for part in msg.parts]
        tool_calls = [p for p in parts if isinstance(p, ToolCallPart)]
        tool_returns = [p for p in parts if isinstance(p, ToolReturnPart)]
        assert len(tool_calls) == 1
        assert len(tool_returns) == 1
        assert tool_returns[0].tool_call_id == "call1"
        assert tool_returns[0].outcome == "failed"

    def test_unresolved_call_without_this_fix_would_have_no_return(self) -> None:
        # Documents the bug directly: an unresolved part loaded as-is produces
        # a `ToolCallPart` with no matching `ToolReturnPart`.
        message = _assistant_message(
            ToolInputAvailablePart(type="tool-run_code", tool_call_id="call1", input={"code": "1"})
        )
        history = VercelAIAdapter.load_messages([message])
        parts = [part for msg in history for part in msg.parts]
        assert any(isinstance(p, ToolCallPart) for p in parts)
        assert not any(isinstance(p, ToolReturnPart) for p in parts)
