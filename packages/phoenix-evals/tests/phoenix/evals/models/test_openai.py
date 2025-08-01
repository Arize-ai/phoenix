from unittest import mock

import pytest
from openai import AzureOpenAI, OpenAI
from openai.types import Completion, CompletionChoice, CompletionUsage
from openai.types.chat import ChatCompletion, ChatCompletionMessage
from openai.types.chat.chat_completion import Choice
from openai.types.chat.chat_completion_message import FunctionCall
from openai.types.chat.chat_completion_message_tool_call import (
    ChatCompletionMessageToolCall,
    Function,
)
from openai.types.completion_usage import CompletionUsage as ChatCompletionUsage

from phoenix.evals.models.openai import OpenAIModel

OPENAI_API_KEY_ENVVAR_NAME = "OPENAI_API_KEY"
AZURE_OPENAI_API_KEY_ENVVAR_NAME = "AZURE_OPENAI_API_KEY"


def test_instantiation_by_positional_args_is_not_allowed():
    with pytest.raises(AssertionError, match="positional arguments"):
        OpenAIModel("gpt-4-turbo-preview")


def test_openai_model(monkeypatch):
    """
    Sanity check of the initialization of OpenAI wrapper
    NB: this is intentionally white-box testing since
    we have very little type safety in the OpenAI wrapper
    """
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel(model="gpt-4-turbo-preview")

    assert model.model == "gpt-4-turbo-preview"
    assert isinstance(model._client, OpenAI)


def test_azure_openai_model(monkeypatch):
    monkeypatch.setenv(AZURE_OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-07-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
    )
    assert isinstance(model._client, AzureOpenAI)


def test_azure_openai_model_added_custom_header(monkeypatch):
    monkeypatch.setenv(AZURE_OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    header_key = "header"
    header_value = "my-example-header-value"
    default_headers = {header_key: header_value}
    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-07-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
        default_headers=default_headers,
    )

    assert isinstance(model._client, AzureOpenAI)
    # check if custom header is added to headers
    assert (
        header_key in model._client.default_headers
        and model._client.default_headers.get(header_key) == header_value
    )
    assert (
        header_key in model._async_client.default_headers
        and model._async_client.default_headers.get(header_key) == header_value
    )


def test_azure_fails_when_missing_options(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    # Test missing api_version
    with pytest.raises(
        ValueError, match="Option 'api_version' must be set when using Azure OpenAI"
    ):
        OpenAIModel(
            model="gpt-4-turbo-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )


def test_azure_supports_function_calling(monkeypatch):
    monkeypatch.setenv(AZURE_OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-07-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
    )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is True

    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-06-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
    )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is False


def test_model_name_deprecation(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with pytest.warns(DeprecationWarning, match="The `model_name` field is deprecated"):
        model = OpenAIModel(model_name="gpt-4-turbo-preview")
    assert model.model == "gpt-4-turbo-preview"
    assert model.model_name is None


@mock.patch("openai.resources.chat.completions.Completions.create")
def test_selfhosted(completions_create):
    mock_completion = ChatCompletion(
        object="chat.completion",
        id="abc",
        model="xyz",
        created=123,
        choices=[
            Choice(
                index=0,
                finish_reason="stop",
                message=ChatCompletionMessage(role="assistant", content="42 per tail"),
            )
        ],
    )
    completions_create.return_value = mock_completion
    model = OpenAIModel(
        model="monstral", base_url="http://hosted.openai.me:8000/v1", api_key="bogus"
    )
    result = model("How much is the fish?")

    assert result == "42 per tail"
    assert "http://hosted.openai.me:8000/v1" in str(model._client.base_url)
    assert model._client.api_key == "bogus"
    call_args = completions_create.call_args[1]
    assert call_args["model"] == "monstral"
    assert call_args["messages"][0]["content"] == "How much is the fish?"


class TestParseOutput:
    @pytest.fixture
    def model(self, monkeypatch: pytest.MonkeyPatch) -> OpenAIModel:
        """Fixture to create an OpenAIModel."""
        monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-fake-key")
        return OpenAIModel()

    def test_parse_output_chat_completion_with_content(self, model: OpenAIModel) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-123",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="stop",
                    message=ChatCompletionMessage(role="assistant", content="Hello, world!"),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=10,
                completion_tokens=5,
                total_tokens=15,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Hello, world!"
        assert usage.prompt_tokens == 10
        assert usage.completion_tokens == 5
        assert usage.total_tokens == 15

    def test_parse_output_chat_completion_with_tool_calls(self, model: OpenAIModel) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-456",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="tool_calls",
                    message=ChatCompletionMessage(
                        role="assistant",
                        content="Using a tool",
                        tool_calls=[
                            ChatCompletionMessageToolCall(
                                id="call_123",
                                type="function",
                                function=Function(
                                    name="get_weather",
                                    arguments='{"city": "San Francisco", "units": "celsius"}',
                                ),
                            )
                        ],
                    ),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=20,
                completion_tokens=15,
                total_tokens=35,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"city": "San Francisco", "units": "celsius"}'
        assert usage.prompt_tokens == 20
        assert usage.completion_tokens == 15
        assert usage.total_tokens == 35

    def test_parse_output_chat_completion_with_function_call(self, model: OpenAIModel) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-789",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="function_call",
                    message=ChatCompletionMessage(
                        role="assistant",
                        content="Calling function",
                        function_call=FunctionCall(
                            name="search",
                            arguments='{"query": "python programming"}',
                        ),
                    ),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=15,
                completion_tokens=8,
                total_tokens=23,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"query": "python programming"}'
        assert usage.prompt_tokens == 15
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 23

    def test_parse_output_chat_completion_with_empty_content(self, model: OpenAIModel) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-empty",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="stop",
                    message=ChatCompletionMessage(role="assistant", content=None),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=5,
                completion_tokens=0,
                total_tokens=5,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 5

    def test_parse_output_chat_completion_with_empty_tool_arguments(
        self, model: OpenAIModel
    ) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-empty-args",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="tool_calls",
                    message=ChatCompletionMessage(
                        role="assistant",
                        content="Tool with no args",
                        tool_calls=[
                            ChatCompletionMessageToolCall(
                                id="call_empty",
                                type="function",
                                function=Function(name="get_time", arguments=""),
                            )
                        ],
                    ),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=8,
                completion_tokens=3,
                total_tokens=11,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Tool with no args"
        assert usage.prompt_tokens == 8
        assert usage.completion_tokens == 3
        assert usage.total_tokens == 11

    def test_parse_output_chat_completion_with_multiple_tool_calls(
        self, model: OpenAIModel
    ) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-multi",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="tool_calls",
                    message=ChatCompletionMessage(
                        role="assistant",
                        content="Multiple tools",
                        tool_calls=[
                            ChatCompletionMessageToolCall(
                                id="call_1",
                                type="function",
                                function=Function(
                                    name="first_tool",
                                    arguments='{"param": "first"}',
                                ),
                            ),
                            ChatCompletionMessageToolCall(
                                id="call_2",
                                type="function",
                                function=Function(
                                    name="second_tool",
                                    arguments='{"param": "second"}',
                                ),
                            ),
                        ],
                    ),
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=25,
                completion_tokens=18,
                total_tokens=43,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        # Should return the first tool call with arguments
        assert text == '{"param": "first"}'
        assert usage.prompt_tokens == 25
        assert usage.completion_tokens == 18
        assert usage.total_tokens == 43

    def test_parse_output_legacy_completion(self, model: OpenAIModel) -> None:
        response = Completion(
            object="text_completion",
            id="cmpl-legacy",
            model="gpt-3.5-turbo-instruct",
            created=1677652288,
            choices=[
                CompletionChoice(
                    index=0,
                    finish_reason="stop",
                    text="This is a legacy completion response.",
                )
            ],
            usage=CompletionUsage(
                prompt_tokens=12,
                completion_tokens=8,
                total_tokens=20,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "This is a legacy completion response."
        assert usage.prompt_tokens == 12
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 20

    def test_parse_output_without_usage(self, model: OpenAIModel) -> None:
        response = ChatCompletion(
            object="chat.completion",
            id="chatcmpl-no-usage",
            model="gpt-4",
            created=1677652288,
            choices=[
                Choice(
                    index=0,
                    finish_reason="stop",
                    message=ChatCompletionMessage(
                        role="assistant", content="Response without usage"
                    ),
                )
            ],
            usage=None,
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Response without usage"
        assert usage is None
