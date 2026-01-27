from typing import Any

from strawberry import UNSET

from phoenix.db.types.experiment_config import (
    TaskConfig,
)
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.experiment_config_converters import (
    _convert_message,
    _convert_role,
    _convert_tool_call,
    _extract_param_value,
    create_task_config,
    invocation_parameters_to_prompt,
    messages_to_prompt_template,
    tools_to_prompt_tools,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptOpenAIInvocationParameters,
    PromptTemplateFormat,
    TextContentPart,
    ToolCallContentPart,
    ToolResultContentPart,
)
from phoenix.server.api.input_types.ChatCompletionMessageInput import ChatCompletionMessageInput
from phoenix.server.api.input_types.InvocationParameters import InvocationParameterInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


class TestConvertRole:
    def test_converts_user_role(self) -> None:
        assert _convert_role(ChatCompletionMessageRole.USER) == "user"

    def test_converts_ai_role(self) -> None:
        assert _convert_role(ChatCompletionMessageRole.AI) == "ai"

    def test_converts_system_role(self) -> None:
        assert _convert_role(ChatCompletionMessageRole.SYSTEM) == "system"

    def test_converts_tool_role(self) -> None:
        assert _convert_role(ChatCompletionMessageRole.TOOL) == "tool"


class TestConvertToolCall:
    def test_converts_openai_format_tool_call(self) -> None:
        tool_call = {
            "id": "call_abc123",
            "function": {
                "name": "get_weather",
                "arguments": '{"location": "San Francisco"}',
            },
        }
        result = _convert_tool_call(tool_call)

        assert isinstance(result, ToolCallContentPart)
        assert result.type == "tool_call"
        assert result.tool_call_id == "call_abc123"
        assert result.tool_call.name == "get_weather"
        assert result.tool_call.arguments == '{"location": "San Francisco"}'

    def test_handles_missing_fields(self) -> None:
        tool_call: dict[str, Any] = {}
        result = _convert_tool_call(tool_call)

        assert result.tool_call_id == ""
        assert result.tool_call.name == ""
        assert result.tool_call.arguments == "{}"

    def test_handles_partial_function_info(self) -> None:
        tool_call = {"id": "call_123", "function": {"name": "my_func"}}
        result = _convert_tool_call(tool_call)

        assert result.tool_call_id == "call_123"
        assert result.tool_call.name == "my_func"
        assert result.tool_call.arguments == "{}"


class TestConvertMessage:
    def test_converts_simple_text_message(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.USER,
            content="Hello, world!",
        )
        result = _convert_message(msg)

        assert result.role == "user"
        # Simple text messages use string content (optimization)
        assert result.content == "Hello, world!"

    def test_converts_assistant_message_with_tool_calls(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.AI,
            content="Let me check the weather.",
            tool_calls=[
                {
                    "id": "call_123",
                    "function": {"name": "get_weather", "arguments": '{"city": "NYC"}'},
                }
            ],
        )
        result = _convert_message(msg)

        assert result.role == "ai"
        assert isinstance(result.content, list)
        assert len(result.content) == 2
        assert isinstance(result.content[0], TextContentPart)
        assert result.content[0].text == "Let me check the weather."
        assert isinstance(result.content[1], ToolCallContentPart)
        assert result.content[1].tool_call.name == "get_weather"

    def test_converts_tool_result_message(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.TOOL,
            content='{"temperature": 72}',
            tool_call_id="call_123",
        )
        result = _convert_message(msg)

        assert result.role == "tool"
        assert isinstance(result.content, list)
        assert len(result.content) == 1
        assert isinstance(result.content[0], ToolResultContentPart)
        assert result.content[0].tool_call_id == "call_123"
        assert result.content[0].tool_result == '{"temperature": 72}'

    def test_converts_empty_content(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.AI,
            content="",
        )
        result = _convert_message(msg)

        assert result.role == "ai"
        assert result.content == ""

    def test_handles_unset_tool_calls(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.USER,
            content="Hello",
            tool_calls=UNSET,
        )
        result = _convert_message(msg)

        assert result.content == "Hello"

    def test_converts_non_string_content(self) -> None:
        # Content can be JSON (dict, int, etc.) - should be stringified
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.USER,
            content={"key": "value"},
        )
        result = _convert_message(msg)

        assert result.role == "user"
        assert result.content == "{'key': 'value'}"

    def test_converts_multiple_tool_calls(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.AI,
            content="I'll help with both.",
            tool_calls=[
                {"id": "call_1", "function": {"name": "get_weather", "arguments": "{}"}},
                {"id": "call_2", "function": {"name": "get_time", "arguments": "{}"}},
            ],
        )
        result = _convert_message(msg)

        assert isinstance(result.content, list)
        assert len(result.content) == 3  # 1 text + 2 tool calls
        assert isinstance(result.content[0], TextContentPart)
        assert isinstance(result.content[1], ToolCallContentPart)
        assert isinstance(result.content[2], ToolCallContentPart)
        assert result.content[1].tool_call.name == "get_weather"
        assert result.content[2].tool_call.name == "get_time"

    def test_converts_tool_call_only_message(self) -> None:
        # Assistant message with tool calls but no text content
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.AI,
            content="",
            tool_calls=[
                {"id": "call_1", "function": {"name": "search", "arguments": '{"q": "test"}'}},
            ],
        )
        result = _convert_message(msg)

        assert isinstance(result.content, list)
        assert len(result.content) == 1
        assert isinstance(result.content[0], ToolCallContentPart)

    def test_handles_none_content(self) -> None:
        msg = ChatCompletionMessageInput(
            role=ChatCompletionMessageRole.AI,
            content=None,
        )
        result = _convert_message(msg)

        assert result.content == ""


class TestMessagesToPromptTemplate:
    def test_converts_message_list_to_chat_template(self) -> None:
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.SYSTEM,
                content="You are a helpful assistant.",
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.USER,
                content="What is the weather?",
            ),
        ]
        result = messages_to_prompt_template(messages)

        assert isinstance(result, PromptChatTemplate)
        assert result.type == "chat"
        assert len(result.messages) == 2
        assert result.messages[0].role == "system"
        assert result.messages[0].content == "You are a helpful assistant."
        assert result.messages[1].role == "user"
        assert result.messages[1].content == "What is the weather?"

    def test_handles_empty_message_list(self) -> None:
        result = messages_to_prompt_template([])

        assert isinstance(result, PromptChatTemplate)
        assert len(result.messages) == 0

    def test_converts_multi_turn_conversation_with_tool_use(self) -> None:
        """Test a full conversation: system → user → assistant (tool call) → tool result."""
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.SYSTEM,
                content="You are a helpful assistant with access to tools.",
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.USER,
                content="What's the weather in NYC?",
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.AI,
                content="Let me check the weather for you.",
                tool_calls=[
                    {
                        "id": "call_weather_123",
                        "function": {
                            "name": "get_weather",
                            "arguments": '{"city": "NYC"}',
                        },
                    }
                ],
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.TOOL,
                content='{"temperature": 72, "condition": "sunny"}',
                tool_call_id="call_weather_123",
            ),
        ]
        result = messages_to_prompt_template(messages)

        assert len(result.messages) == 4

        # System message
        assert result.messages[0].role == "system"
        assert result.messages[0].content == "You are a helpful assistant with access to tools."

        # User message
        assert result.messages[1].role == "user"
        assert result.messages[1].content == "What's the weather in NYC?"

        # Assistant with tool call
        assert result.messages[2].role == "ai"
        assert isinstance(result.messages[2].content, list)
        assert len(result.messages[2].content) == 2
        assert isinstance(result.messages[2].content[0], TextContentPart)
        assert isinstance(result.messages[2].content[1], ToolCallContentPart)
        assert result.messages[2].content[1].tool_call_id == "call_weather_123"

        # Tool result
        assert result.messages[3].role == "tool"
        assert isinstance(result.messages[3].content, list)
        assert isinstance(result.messages[3].content[0], ToolResultContentPart)
        assert result.messages[3].content[0].tool_call_id == "call_weather_123"


class TestExtractParamValue:
    def test_extracts_int_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="max_tokens",
            value_int=100,
        )
        assert _extract_param_value(param) == 100

    def test_extracts_float_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="temperature",
            value_float=0.7,
        )
        assert _extract_param_value(param) == 0.7

    def test_extracts_string_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="model",
            value_string="gpt-4",
        )
        assert _extract_param_value(param) == "gpt-4"

    def test_extracts_bool_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="stream",
            value_bool=True,
        )
        assert _extract_param_value(param) is True

    def test_extracts_boolean_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="stream",
            value_boolean=False,
        )
        assert _extract_param_value(param) is False

    def test_extracts_json_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="metadata",
            value_json={"key": "value"},
        )
        assert _extract_param_value(param) == {"key": "value"}

    def test_extracts_string_list_value(self) -> None:
        param = InvocationParameterInput(
            invocation_name="stop",
            value_string_list=[".", "!", "?"],
        )
        assert _extract_param_value(param) == [".", "!", "?"]

    def test_returns_none_for_no_value(self) -> None:
        param = InvocationParameterInput(invocation_name="empty")
        assert _extract_param_value(param) is None

    def test_ignores_unset_values(self) -> None:
        param = InvocationParameterInput(
            invocation_name="test",
            value_int=UNSET,
        )
        assert _extract_param_value(param) is None

    def test_json_value_takes_priority(self) -> None:
        # When multiple values are set, json should be checked first
        param = InvocationParameterInput(
            invocation_name="test",
            value_json={"priority": "json"},
            value_int=42,
            value_string="string_value",
        )
        assert _extract_param_value(param) == {"priority": "json"}


class TestInvocationParametersToPrompt:
    def test_converts_params_to_openai_format(self) -> None:
        params = [
            InvocationParameterInput(invocation_name="temperature", value_float=0.7),
            InvocationParameterInput(invocation_name="max_tokens", value_int=100),
        ]
        result = invocation_parameters_to_prompt(params, ModelProvider.OPENAI)

        assert isinstance(result, PromptOpenAIInvocationParameters)
        assert result.openai.temperature == 0.7
        assert result.openai.max_tokens == 100

    def test_returns_none_for_empty_params(self) -> None:
        result = invocation_parameters_to_prompt([], ModelProvider.OPENAI)
        assert result is None

    def test_returns_none_for_all_none_values(self) -> None:
        params = [
            InvocationParameterInput(invocation_name="test"),
        ]
        result = invocation_parameters_to_prompt(params, ModelProvider.OPENAI)
        assert result is None

    def test_converts_params_to_anthropic_format(self) -> None:
        from phoenix.server.api.helpers.prompts.models import (
            PromptAnthropicInvocationParameters,
        )

        params = [
            InvocationParameterInput(invocation_name="temperature", value_float=0.5),
            InvocationParameterInput(invocation_name="max_tokens", value_int=1024),
        ]
        result = invocation_parameters_to_prompt(params, ModelProvider.ANTHROPIC)

        assert isinstance(result, PromptAnthropicInvocationParameters)
        assert result.anthropic.temperature == 0.5
        assert result.anthropic.max_tokens == 1024


class TestToolsToPromptTools:
    def test_converts_openai_tool_definitions(self) -> None:
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        result = tools_to_prompt_tools(tools, ModelProvider.OPENAI)

        assert result is not None
        assert len(result.tools) == 1
        assert result.tools[0].function.name == "get_weather"

    def test_returns_none_for_empty_tools(self) -> None:
        result = tools_to_prompt_tools([], ModelProvider.OPENAI)
        assert result is None

    def test_returns_none_for_none_tools(self) -> None:
        result = tools_to_prompt_tools(None, ModelProvider.OPENAI)
        assert result is None


class TestCreateTaskConfig:
    def test_creates_complete_task_config(self) -> None:
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.USER,
                content="Hello {{name}}",
            )
        ]
        params = [
            InvocationParameterInput(invocation_name="temperature", value_float=0.5),
        ]
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "greet",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]

        result = create_task_config(
            messages=messages,
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables_path="input",
            invocation_parameters=params,
            tools=tools,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
        )

        assert isinstance(result, TaskConfig)
        assert isinstance(result.prompt_version.template, PromptChatTemplate)
        assert result.prompt_version.template_format == PromptTemplateFormat.MUSTACHE
        assert result.template_variables_path == "input"
        assert result.prompt_version.invocation_parameters is not None
        assert result.prompt_version.tools is not None

    def test_creates_minimal_task_config(self) -> None:
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.USER,
                content="Hello",
            )
        ]

        result = create_task_config(
            messages=messages,
            template_format=PromptTemplateFormat.NONE,
            template_variables_path=None,
            invocation_parameters=[],
            tools=None,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
        )

        assert isinstance(result, TaskConfig)
        assert result.prompt_version.invocation_parameters is None
        assert result.prompt_version.tools is None


class TestSerializationRoundTrip:
    """Test that converted objects can be serialized to JSON and back."""

    def test_task_config_serialization_round_trip(self) -> None:
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.SYSTEM,
                content="You are helpful.",
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.USER,
                content="Hello {{name}}",
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.AI,
                content="Hi there!",
                tool_calls=[
                    {"id": "call_1", "function": {"name": "greet", "arguments": "{}"}},
                ],
            ),
        ]
        params = [
            InvocationParameterInput(invocation_name="temperature", value_float=0.7),
            InvocationParameterInput(invocation_name="max_tokens", value_int=100),
        ]
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "greet",
                    "description": "Greet the user",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]

        original = create_task_config(
            messages=messages,
            template_format=PromptTemplateFormat.MUSTACHE,
            template_variables_path="input",
            invocation_parameters=params,
            tools=tools,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
        )

        # Serialize to dict (simulates JSON serialization for DB)
        serialized = original.model_dump()

        # Deserialize back
        restored = TaskConfig.model_validate(serialized)

        # Verify key fields match
        assert restored.prompt_version.template_format == original.prompt_version.template_format
        assert restored.template_variables_path == original.template_variables_path
        restored_template = restored.prompt_version.template
        original_template = original.prompt_version.template
        assert isinstance(restored_template, PromptChatTemplate)
        assert isinstance(original_template, PromptChatTemplate)
        assert len(restored_template.messages) == len(original_template.messages)
        assert restored_template.messages[0].role == "system"
        assert restored_template.messages[1].role == "user"
        assert restored_template.messages[2].role == "ai"

    def test_prompt_template_serialization_preserves_content_parts(self) -> None:
        """Verify that structured content parts survive serialization."""
        messages = [
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.AI,
                content="Using tools",
                tool_calls=[
                    {"id": "call_1", "function": {"name": "func1", "arguments": '{"a": 1}'}},
                ],
            ),
            ChatCompletionMessageInput(
                role=ChatCompletionMessageRole.TOOL,
                content='{"result": "done"}',
                tool_call_id="call_1",
            ),
        ]

        template = messages_to_prompt_template(messages)
        serialized = template.model_dump()
        restored = PromptChatTemplate.model_validate(serialized)

        # Check assistant message with tool call
        assert isinstance(restored.messages[0].content, list)
        assert len(restored.messages[0].content) == 2
        # After deserialization, content parts are Pydantic models
        assert isinstance(restored.messages[0].content[0], TextContentPart)
        assert isinstance(restored.messages[0].content[1], ToolCallContentPart)
        assert restored.messages[0].content[0].type == "text"
        assert restored.messages[0].content[1].type == "tool_call"

        # Check tool result message
        assert isinstance(restored.messages[1].content, list)
        assert isinstance(restored.messages[1].content[0], ToolResultContentPart)
        assert restored.messages[1].content[0].type == "tool_result"
