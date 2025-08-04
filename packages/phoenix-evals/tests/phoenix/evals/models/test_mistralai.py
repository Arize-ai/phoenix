import pytest
from mistralai import Mistral
from mistralai.models import (
    AssistantMessage,
    ChatCompletionChoice,
    ChatCompletionResponse,
    FunctionCall,
    ToolCall,
    UsageInfo,
)

from phoenix.evals.models.mistralai import MistralAIModel


def test_instantiation_by_positional_args_is_not_allowed() -> None:
    with pytest.raises(AssertionError, match="positional arguments"):
        MistralAIModel("mistral-large-latest")


def test_mistral_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MISTRAL_API_KEY", "fake-mistral-key")
    model = MistralAIModel(model="mistral-large-latest")

    assert model.model == "mistral-large-latest"
    assert isinstance(model._client, Mistral)


class TestParseOutput:
    @pytest.fixture
    def model(self, monkeypatch: pytest.MonkeyPatch) -> MistralAIModel:
        """Fixture to create a MistralAIModel."""
        monkeypatch.setenv("MISTRAL_API_KEY", "fake-mistral-key")
        return MistralAIModel()

    def test_parse_output_with_tool_calls(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-e5cc70bb28c444948073e77776eb30ef",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=16, completion_tokens=34, total_tokens=50),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="string",
                        tool_calls=[
                            ToolCall(
                                id="null",
                                type="function",
                                function=FunctionCall(name="string", arguments={}),
                                index=0,
                            )
                        ],
                        prefix=False,
                        role="assistant",
                    ),
                    finish_reason="stop",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "string"
        assert usage.prompt_tokens == 16
        assert usage.completion_tokens == 34
        assert usage.total_tokens == 50

    def test_parse_output_with_regular_content(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-123",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=10, completion_tokens=20, total_tokens=30),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(content="Hello, world!", role="assistant"),
                    finish_reason="stop",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Hello, world!"
        assert usage.prompt_tokens == 10
        assert usage.completion_tokens == 20
        assert usage.total_tokens == 30

    def test_parse_output_with_dict_arguments(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-456",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=5, completion_tokens=15, total_tokens=20),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="assistant response",
                        tool_calls=[
                            ToolCall(
                                id="call_123",
                                type="function",
                                function=FunctionCall(
                                    name="get_weather",
                                    arguments={"city": "San Francisco", "units": "celsius"},
                                ),
                                index=0,
                            )
                        ],
                        role="assistant",
                    ),
                    finish_reason="tool_calls",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"city": "San Francisco", "units": "celsius"}'
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 15
        assert usage.total_tokens == 20

    def test_parse_output_with_empty_content(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-empty",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=5, completion_tokens=0, total_tokens=5),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(content=None, role="assistant"),
                    finish_reason="stop",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 5

    def test_parse_output_with_string_tool_arguments(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-string-args",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=8, completion_tokens=12, total_tokens=20),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="Using tool",
                        tool_calls=[
                            ToolCall(
                                id="call_str",
                                type="function",
                                function=FunctionCall(
                                    name="search",
                                    arguments="python programming",
                                ),
                                index=0,
                            )
                        ],
                        role="assistant",
                    ),
                    finish_reason="tool_calls",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "python programming"
        assert usage.prompt_tokens == 8
        assert usage.completion_tokens == 12
        assert usage.total_tokens == 20

    def test_parse_output_with_empty_tool_arguments(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-empty-args",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=6, completion_tokens=8, total_tokens=14),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="Empty arguments provided",
                        tool_calls=[
                            ToolCall(
                                id="call_empty_args",
                                type="function",
                                function=FunctionCall(name="get_time", arguments={}),
                                index=0,
                            )
                        ],
                        role="assistant",
                    ),
                    finish_reason="tool_calls",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Empty arguments provided"
        assert usage.prompt_tokens == 6
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 14

    def test_parse_output_with_no_tool_calls(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-no-tools",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=4, completion_tokens=6, total_tokens=10),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="No tool calls",
                        role="assistant",
                    ),
                    finish_reason="stop",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "No tool calls"
        assert usage.prompt_tokens == 4
        assert usage.completion_tokens == 6
        assert usage.total_tokens == 10

    def test_parse_output_with_multiple_tool_calls(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-multi-tools",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=12, completion_tokens=25, total_tokens=37),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="Multiple tools",
                        tool_calls=[
                            ToolCall(
                                id="call_1",
                                type="function",
                                function=FunctionCall(
                                    name="first_tool",
                                    arguments={"param": "value1"},
                                ),
                                index=0,
                            ),
                            ToolCall(
                                id="call_2",
                                type="function",
                                function=FunctionCall(
                                    name="second_tool",
                                    arguments="string_arg",
                                ),
                                index=1,
                            ),
                        ],
                        role="assistant",
                    ),
                    finish_reason="tool_calls",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        # Should return the first tool call with arguments
        assert text == '{"param": "value1"}'
        assert usage.prompt_tokens == 12
        assert usage.completion_tokens == 25
        assert usage.total_tokens == 37

    def test_parse_output_with_zero_usage(self, model: MistralAIModel) -> None:
        response = ChatCompletionResponse(
            id="cmpl-zero-usage",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(content="Zero usage", role="assistant"),
                    finish_reason="stop",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Zero usage"
        assert usage.prompt_tokens == 0
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 0

    def test_parse_output_with_complex_json_arguments(self, model: MistralAIModel) -> None:
        complex_args = {
            "query": "weather forecast",
            "location": {"city": "New York", "country": "US"},
            "options": {"units": "metric", "days": 7},
            "filters": ["temperature", "humidity", "precipitation"],
        }
        response = ChatCompletionResponse(
            id="cmpl-complex",
            object="chat.completion",
            model="mistral-small-latest",
            usage=UsageInfo(prompt_tokens=20, completion_tokens=45, total_tokens=65),
            created=1702256327,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=AssistantMessage(
                        content="Complex query",
                        tool_calls=[
                            ToolCall(
                                id="call_complex",
                                type="function",
                                function=FunctionCall(
                                    name="weather_query",
                                    arguments=complex_args,
                                ),
                                index=0,
                            )
                        ],
                        role="assistant",
                    ),
                    finish_reason="tool_calls",
                )
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        # Verify it's valid JSON and contains expected data
        import json

        parsed_args = json.loads(text)
        assert parsed_args == complex_args
        assert usage.prompt_tokens == 20
        assert usage.completion_tokens == 45
        assert usage.total_tokens == 65
