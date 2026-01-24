from typing import Any

import pytest

from phoenix.server.api.helpers.message_helpers import (
    ChatCompletionMessage,
    convert_openai_message_to_internal,
    extract_and_convert_example_messages,
    extract_value_from_path,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


class TestExtractValueFromPath:
    """Tests for extract_value_from_path function."""

    def test_simple_path(self) -> None:
        data = {"messages": [{"role": "user", "content": "Hello"}]}
        result = extract_value_from_path(data, "messages")
        assert result == [{"role": "user", "content": "Hello"}]

    def test_nested_path(self) -> None:
        data = {"input": {"messages": [{"role": "user", "content": "Hello"}]}}
        result = extract_value_from_path(data, "input.messages")
        assert result == [{"role": "user", "content": "Hello"}]

    def test_deeply_nested_path(self) -> None:
        data = {"a": {"b": {"c": {"d": "value"}}}}
        result = extract_value_from_path(data, "a.b.c.d")
        assert result == "value"

    def test_empty_path_raises_key_error(self) -> None:
        data: dict[str, Any] = {"messages": []}
        with pytest.raises(KeyError, match="Empty path provided"):
            extract_value_from_path(data, "")

    def test_missing_key_raises_key_error(self) -> None:
        data: dict[str, Any] = {"messages": []}
        with pytest.raises(KeyError, match="Key 'nonexistent' not found"):
            extract_value_from_path(data, "nonexistent")

    def test_missing_nested_key_raises_key_error(self) -> None:
        data = {"input": {"other": "value"}}
        with pytest.raises(KeyError, match="Key 'messages' not found"):
            extract_value_from_path(data, "input.messages")

    def test_non_dict_intermediate_raises_type_error(self) -> None:
        data = {"input": "string_value"}
        with pytest.raises(TypeError, match="intermediate value is not a dict"):
            extract_value_from_path(data, "input.messages")

    def test_list_intermediate_raises_type_error(self) -> None:
        data: dict[str, Any] = {"input": [{"messages": []}]}
        with pytest.raises(TypeError, match="intermediate value is not a dict"):
            extract_value_from_path(data, "input.messages")


class TestConvertOpenaiMessageToInternal:
    """Tests for convert_openai_message_to_internal function."""

    @pytest.mark.parametrize(
        "openai_message, expected",
        [
            pytest.param(
                {"role": "user", "content": "Hello, how are you?"},
                (ChatCompletionMessageRole.USER, "Hello, how are you?", None, None),
                id="simple-user-message",
            ),
            pytest.param(
                {"role": "assistant", "content": "I'm doing well, thanks!"},
                (ChatCompletionMessageRole.AI, "I'm doing well, thanks!", None, None),
                id="simple-assistant-message",
            ),
            pytest.param(
                {"role": "system", "content": "You are a helpful assistant."},
                (
                    ChatCompletionMessageRole.SYSTEM,
                    "You are a helpful assistant.",
                    None,
                    None,
                ),
                id="simple-system-message",
            ),
            pytest.param(
                {"role": "USER", "content": "Uppercase role"},
                (ChatCompletionMessageRole.USER, "Uppercase role", None, None),
                id="uppercase-role",
            ),
            pytest.param(
                {"role": "Assistant", "content": "Mixed case role"},
                (ChatCompletionMessageRole.AI, "Mixed case role", None, None),
                id="mixed-case-role",
            ),
            pytest.param(
                {"role": "ai", "content": "Using internal role name"},
                (ChatCompletionMessageRole.AI, "Using internal role name", None, None),
                id="internal-ai-role-name",
            ),
            pytest.param(
                {"role": "unknown_role", "content": "Unknown role defaults to user"},
                (
                    ChatCompletionMessageRole.USER,
                    "Unknown role defaults to user",
                    None,
                    None,
                ),
                id="unknown-role-defaults-to-user",
            ),
            pytest.param(
                {"content": "Missing role defaults to user"},
                (
                    ChatCompletionMessageRole.USER,
                    "Missing role defaults to user",
                    None,
                    None,
                ),
                id="missing-role-defaults-to-user",
            ),
        ],
    )
    def test_role_conversion(
        self, openai_message: dict[str, Any], expected: ChatCompletionMessage
    ) -> None:
        result = convert_openai_message_to_internal(openai_message)
        assert result == expected

    @pytest.mark.parametrize(
        "openai_message, expected",
        [
            pytest.param(
                {"role": "user", "content": "Hello"},
                (ChatCompletionMessageRole.USER, "Hello", None, None),
                id="string-content",
            ),
            pytest.param(
                {"role": "user", "content": None},
                (ChatCompletionMessageRole.USER, "", None, None),
                id="null-content-becomes-empty-string",
            ),
            pytest.param(
                {"role": "user"},
                (ChatCompletionMessageRole.USER, "", None, None),
                id="missing-content-becomes-empty-string",
            ),
            pytest.param(
                {"role": "user", "content": ""},
                (ChatCompletionMessageRole.USER, "", None, None),
                id="empty-string-content",
            ),
            pytest.param(
                {"role": "user", "content": 123},
                (ChatCompletionMessageRole.USER, "123", None, None),
                id="numeric-content-converted-to-string",
            ),
        ],
    )
    def test_content_handling(
        self, openai_message: dict[str, Any], expected: ChatCompletionMessage
    ) -> None:
        result = convert_openai_message_to_internal(openai_message)
        assert result == expected

    @pytest.mark.parametrize(
        "openai_message, expected_content",
        [
            pytest.param(
                {
                    "role": "user",
                    "content": [{"type": "text", "text": "Hello from multimodal"}],
                },
                "Hello from multimodal",
                id="single-text-part",
            ),
            pytest.param(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "First part"},
                        {"type": "text", "text": "Second part"},
                    ],
                },
                "First part\nSecond part",
                id="multiple-text-parts-joined-with-newline",
            ),
            pytest.param(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Text content"},
                        {
                            "type": "image_url",
                            "image_url": {"url": "http://example.com/image.png"},
                        },
                    ],
                },
                "Text content",
                id="mixed-content-extracts-only-text",
            ),
            pytest.param(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": "http://example.com/image.png"},
                        },
                    ],
                },
                "",
                id="image-only-content-becomes-empty",
            ),
            pytest.param(
                {"role": "user", "content": ["plain string in array"]},
                "plain string in array",
                id="string-array-content",
            ),
            pytest.param(
                {"role": "user", "content": []},
                "",
                id="empty-array-content",
            ),
        ],
    )
    def test_multimodal_content_handling(
        self, openai_message: dict[str, Any], expected_content: str
    ) -> None:
        result = convert_openai_message_to_internal(openai_message)
        assert result[1] == expected_content

    def test_tool_message_with_tool_call_id(self) -> None:
        openai_message = {
            "role": "tool",
            "content": '{"temperature": 72}',
            "tool_call_id": "call_abc123",
        }
        result = convert_openai_message_to_internal(openai_message)
        assert result == (
            ChatCompletionMessageRole.TOOL,
            '{"temperature": 72}',
            "call_abc123",
            None,
        )

    def test_assistant_message_with_tool_calls(self) -> None:
        tool_calls = [
            {
                "id": "call_abc123",
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "arguments": '{"location": "San Francisco"}',
                },
            }
        ]
        openai_message = {
            "role": "assistant",
            "content": None,
            "tool_calls": tool_calls,
        }
        result = convert_openai_message_to_internal(openai_message)
        assert result[0] == ChatCompletionMessageRole.AI
        assert result[1] == ""
        assert result[2] is None
        # Tool calls are passed through directly
        assert result[3] == tool_calls

    def test_assistant_message_with_multiple_tool_calls(self) -> None:
        tool_calls = [
            {
                "id": "call_abc123",
                "type": "function",
                "function": {"name": "get_weather", "arguments": '{"location": "SF"}'},
            },
            {
                "id": "call_def456",
                "type": "function",
                "function": {"name": "get_time", "arguments": '{"timezone": "PST"}'},
            },
        ]
        openai_message = {
            "role": "assistant",
            "content": "Let me check both for you.",
            "tool_calls": tool_calls,
        }
        result = convert_openai_message_to_internal(openai_message)
        assert result[0] == ChatCompletionMessageRole.AI
        assert result[1] == "Let me check both for you."
        # Tool calls are passed through directly
        assert result[3] == tool_calls

    def test_assistant_message_with_empty_tool_calls_list(self) -> None:
        openai_message = {
            "role": "assistant",
            "content": "No tools needed.",
            "tool_calls": [],
        }
        result = convert_openai_message_to_internal(openai_message)
        # Empty list is passed through directly
        assert result[3] == []


class TestExtractAndConvertExampleMessages:
    """Tests for extract_and_convert_example_messages function."""

    def test_simple_conversation(self) -> None:
        data = {
            "messages": [
                {"role": "user", "content": "Hello!"},
                {"role": "assistant", "content": "Hi there!"},
            ]
        }
        result = extract_and_convert_example_messages(data, "messages")
        assert len(result) == 2
        assert result[0] == (ChatCompletionMessageRole.USER, "Hello!", None, None)
        assert result[1] == (ChatCompletionMessageRole.AI, "Hi there!", None, None)

    def test_nested_messages_path(self) -> None:
        data = {
            "input": {
                "messages": [
                    {"role": "system", "content": "You are helpful."},
                    {"role": "user", "content": "What is 2+2?"},
                ]
            }
        }
        result = extract_and_convert_example_messages(data, "input.messages")
        assert len(result) == 2
        assert result[0] == (
            ChatCompletionMessageRole.SYSTEM,
            "You are helpful.",
            None,
            None,
        )
        assert result[1] == (ChatCompletionMessageRole.USER, "What is 2+2?", None, None)

    def test_openai_fine_tuning_format(self) -> None:
        """Test the OpenAI fine-tuning format as described in the feature spec."""
        data = {
            "messages": [
                {"role": "user", "content": "What is the weather in San Francisco?"},
                {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": "call_id",
                            "type": "function",
                            "function": {
                                "name": "get_current_weather",
                                "arguments": '{"location": "San Francisco, USA", "format": "celsius"}',
                            },
                        }
                    ],
                },
            ],
            "parallel_tool_calls": False,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "get_current_weather",
                        "description": "Get the current weather",
                    },
                }
            ],
        }
        result = extract_and_convert_example_messages(data, "messages")
        assert len(result) == 2
        assert result[0] == (
            ChatCompletionMessageRole.USER,
            "What is the weather in San Francisco?",
            None,
            None,
        )
        assert result[1][0] == ChatCompletionMessageRole.AI
        assert result[1][1] == ""  # No content, just tool calls
        assert result[1][3] is not None
        assert len(result[1][3]) == 1

    def test_tool_response_in_conversation(self) -> None:
        data = {
            "messages": [
                {"role": "user", "content": "What's the weather?"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_123",
                            "type": "function",
                            "function": {"name": "get_weather", "arguments": "{}"},
                        }
                    ],
                },
                {
                    "role": "tool",
                    "content": '{"temp": 72}',
                    "tool_call_id": "call_123",
                },
                {"role": "assistant", "content": "The temperature is 72°F."},
            ]
        }
        result = extract_and_convert_example_messages(data, "messages")
        assert len(result) == 4
        # Check the tool response message
        assert result[2] == (
            ChatCompletionMessageRole.TOOL,
            '{"temp": 72}',
            "call_123",
            None,
        )

    def test_empty_messages_list(self) -> None:
        data: dict[str, Any] = {"messages": []}
        result = extract_and_convert_example_messages(data, "messages")
        assert result == []

    def test_missing_path_raises_key_error(self) -> None:
        data = {"other": "value"}
        with pytest.raises(KeyError):
            extract_and_convert_example_messages(data, "messages")

    def test_non_list_value_raises_type_error(self) -> None:
        data = {"messages": "not a list"}
        with pytest.raises(TypeError, match="is not a list"):
            extract_and_convert_example_messages(data, "messages")

    def test_non_dict_message_raises_value_error(self) -> None:
        data = {"messages": ["not a dict", {"role": "user", "content": "hello"}]}
        with pytest.raises(ValueError, match="Message at index 0 is not a dict"):
            extract_and_convert_example_messages(data, "messages")

    def test_complex_multi_turn_conversation(self) -> None:
        """Test a realistic multi-turn conversation with various message types."""
        data = {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Can you help me with the weather?"},
                {
                    "role": "assistant",
                    "content": "Of course! Which city would you like?",
                },
                {"role": "user", "content": "San Francisco"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_weather_1",
                            "type": "function",
                            "function": {
                                "name": "get_weather",
                                "arguments": '{"city": "San Francisco"}',
                            },
                        }
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": "call_weather_1",
                    "content": '{"temperature": 65, "condition": "sunny"}',
                },
                {
                    "role": "assistant",
                    "content": "It's 65°F and sunny in San Francisco!",
                },
            ]
        }
        result = extract_and_convert_example_messages(data, "messages")
        assert len(result) == 7

        # Verify each message type is correctly converted
        assert result[0][0] == ChatCompletionMessageRole.SYSTEM
        assert result[1][0] == ChatCompletionMessageRole.USER
        assert result[2][0] == ChatCompletionMessageRole.AI
        assert result[3][0] == ChatCompletionMessageRole.USER
        assert result[4][0] == ChatCompletionMessageRole.AI
        assert result[4][3] is not None  # Has tool calls
        assert result[5][0] == ChatCompletionMessageRole.TOOL
        assert result[5][2] == "call_weather_1"  # tool_call_id
        assert result[6][0] == ChatCompletionMessageRole.AI
        assert "65°F" in result[6][1]
