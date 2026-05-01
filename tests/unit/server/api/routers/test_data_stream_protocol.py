import json

from phoenix.server.api.routers.chat_tracing import StreamAccumulator
from phoenix.server.api.routers.data_stream_protocol import (
    ChatBody,
    _anthropic_model_settings_for_cache,
    _backend_tool_loop_limit_error,
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
        assert body.export_remote_traces is False
        assert body.ingest_traces is True
        assert body.trace_name_suffix == "Turn"
        assert body.user_instructions is None
        assert len(body.messages) >= 1

    def test_parses_session_id_and_trace_destination_flags(self) -> None:
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
                "exportRemoteTraces": False,
                "ingestTraces": False,
                "traceNameSuffix": "Summary",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.session_id == "my-session"
        assert body.export_remote_traces is False
        assert body.ingest_traces is False
        assert body.trace_name_suffix == "Summary"

    def test_ignores_legacy_client_tool_definitions(self) -> None:
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
        assert isinstance(body, ChatBody)

    def test_parses_user_instructions(self) -> None:
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
                "userInstructions": "Prefer concise answers.",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.user_instructions == "Prefer concise answers."

        static_part, dynamic_part = body.instruction_parts
        assert static_part.content.startswith("<role>")
        assert static_part.dynamic is False
        assert dynamic_part.dynamic is True
        assert "<user_custom_instructions>\nPrefer concise answers." in dynamic_part.content

    def test_appends_capability_guidance_to_system_prompt(self) -> None:
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
                "userInstructions": "Prefer concise answers.",
                "capabilities": {
                    "bash.retainInactiveSessions": False,
                    "graphql.mutations": True,
                },
            }
        ).encode()
        body = parse_chat_body(raw)

        system_part = body.instruction_parts[1]
        assert system_part.content.startswith("Runtime capability state for this conversation:")
        assert "GraphQL mutations are enabled" in system_part.content
        assert "<user_custom_instructions>\nPrefer concise answers." in system_part.content
        assert body.user_instructions == "Prefer concise answers."
        assert body.capabilities.graphql_mutations is True


class TestAnthropicModelSettingsForCache:
    def test_returns_cache_settings_for_anthropic_model(self) -> None:
        AnthropicModel = type(
            "AnthropicModel",
            (),
            {"__module__": "pydantic_ai.models.anthropic"},
        )

        settings = _anthropic_model_settings_for_cache(AnthropicModel())

        assert settings is not None
        assert settings["anthropic_cache"] is True
        assert settings["anthropic_cache_instructions"] is True
        assert settings["anthropic_cache_tool_definitions"] is True

    def test_returns_none_for_non_anthropic_model(self) -> None:
        OtherModel = type("OtherModel", (), {"__module__": "pydantic_ai.models.openai"})

        assert _anthropic_model_settings_for_cache(OtherModel()) is None


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


class TestBackendToolLoopLimitError:
    def test_returns_error_when_backend_loop_limit_is_exhausted(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=5,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=False,
        )

        assert error is not None
        assert "maximum number of follow-up model calls" in error

    def test_skips_error_before_limit(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=4,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=False,
        )

        assert error is None

    def test_skips_error_when_frontend_tools_are_pending(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=5,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=True,
        )

        assert error is None
