import json

from phoenix.server.api.routers.chat_tracing import StreamAccumulator
from phoenix.server.api.routers.data_stream_protocol import (
    ChatBody,
    parse_chat_body,
)


class TestParseChatBody:
    def test_parses_basic_body(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
            }
        ).encode()
        body = parse_chat_body(raw)
        assert isinstance(body, ChatBody)
        assert body.session_id is None
        assert body.ingest_traces is True
        assert body.trace_name_suffix == "Turn"
        assert body.system is None
        assert body.tools is None
        assert len(body.messages) >= 1

    def test_parses_session_id_and_ingest_traces(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
                "sessionId": "my-session",
                "ingestTraces": False,
                "traceNameSuffix": "Summary",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.session_id == "my-session"
        assert body.ingest_traces is False
        assert body.trace_name_suffix == "Summary"

    def test_parses_tools(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Search for X"}],
                    }
                ],
                "tools": [
                    {"name": "search", "description": "Search the web", "parameters": {}},
                ],
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.tools is not None
        assert len(body.tools) == 1
        assert body.tools[0].name == "search"
        assert len(body.raw_tools) == 1
        assert body.raw_tools[0]["type"] == "function"
        assert body.raw_tools[0]["function"]["name"] == "search"
        assert body.raw_tools[0]["function"]["description"] == "Search the web"

    def test_parses_system_prompt(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
                "system": "You are a helpful assistant.",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.system == "You are a helpful assistant."
        # System prompt should be prepended to messages as a ModelRequest.
        from pydantic_ai.messages import ModelRequest, SystemPromptPart

        first_msg = body.messages[0]
        assert isinstance(first_msg, ModelRequest)
        assert any(isinstance(p, SystemPromptPart) for p in first_msg.parts)


class TestStreamAccumulator:
    def test_accumulates_text(self) -> None:
        acc = StreamAccumulator()
        acc.text_parts.append("Hello ")
        acc.text_parts.append("world!")
        assert acc.accumulated_text == "Hello world!"

    def test_accumulates_tool_calls(self) -> None:
        acc = StreamAccumulator()
        # Simulate tool call start.
        acc._current_tool_meta[0] = {"id": "tc-1", "name": "search"}
        acc._current_tool_args[0] = ['{"q":', '"test"}']
        # Simulate tool call end.
        meta = acc._current_tool_meta.pop(0)
        args = acc._current_tool_args.pop(0)
        acc.tool_calls.append(
            {
                "id": meta["id"],
                "name": meta["name"],
                "arguments": "".join(args),
            }
        )
        assert len(acc.tool_calls) == 1
        assert acc.tool_calls[0]["id"] == "tc-1"
        assert acc.tool_calls[0]["name"] == "search"
        assert acc.tool_calls[0]["arguments"] == '{"q":"test"}'

    def test_empty_accumulator(self) -> None:
        acc = StreamAccumulator()
        assert acc.accumulated_text == ""
        assert acc.tool_calls == []
