import os
import sys
import unittest
from unittest import mock

import pytest
from litellm.types.utils import (
    Choices,
    Message,
    ModelResponse,
    Usage,
)

from phoenix.evals import LiteLLMModel


def test_instantiation_by_positional_args_is_not_allowed():
    with pytest.raises(AssertionError, match="positional arguments"):
        LiteLLMModel("ollama/monstral")


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="https://github.com/BerriAI/litellm/issues/2005",
)
@mock.patch.dict(
    os.environ, {"OLLAMA_API_BASE": "just to make litellm.validate_environment happy"}, clear=True
)
@mock.patch("litellm.llms.ollama.get_ollama_response")
@pytest.mark.xfail(reason="IndexError: tuple index out of range")
def test_selfhosted_ollama_via_model_kwargs(get_ollama_response):
    ollama_response = unittest.mock.MagicMock()
    ollama_response["choices"][0]["message"]["content"] = "barely understand Python mocks"
    ollama_response.choices[0].message.content = "42 per tail"

    get_ollama_response.return_value = ollama_response

    lllmm = LiteLLMModel(
        model="ollama/monstral", model_kwargs=dict(base_url="http://hosted.olla.ma:11434")
    )
    result = lllmm("How much is the fish?")

    assert result == "42 per tail"
    call_args = get_ollama_response.call_args[0]
    assert call_args[0] == "http://hosted.olla.ma:11434"
    assert call_args[1] == "monstral"
    assert "How much is the fish?" in call_args[2]


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="https://github.com/BerriAI/litellm/issues/2005",
)
@mock.patch.dict(os.environ, {"OLLAMA_API_BASE": "http://hosted.olla.ma:11434"}, clear=True)
@mock.patch("litellm.llms.ollama.get_ollama_response")
@pytest.mark.xfail(reason="IndexError: tuple index out of range")
def test_selfhosted_ollama_via_env(get_ollama_response):
    ollama_response = unittest.mock.MagicMock()
    ollama_response["choices"][0]["message"]["content"] = "barely understand Python mocks"
    ollama_response.choices[0].message.content = "42 per tail"

    get_ollama_response.return_value = ollama_response

    lllmm = LiteLLMModel(model="ollama/monstral")
    result = lllmm("How much is the fish?")

    assert result == "42 per tail"
    call_args = get_ollama_response.call_args[0]
    assert call_args[0] == "http://hosted.olla.ma:11434"
    assert call_args[1] == "monstral"
    assert "How much is the fish?" in call_args[2]


class TestParseOutput:
    @pytest.fixture
    def model(self, monkeypatch: pytest.MonkeyPatch) -> LiteLLMModel:
        """Fixture to create an LiteLLMModel."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-key")
        return LiteLLMModel()

    def test_parse_output_with_content(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-123",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[
                Choices(
                    index=0,
                    finish_reason="stop",
                    message=Message(role="assistant", content="Hello, world!"),
                )
            ],
            usage=Usage(
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

    def test_parse_output_with_empty_content(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-empty",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[
                Choices(
                    index=0,
                    finish_reason="stop",
                    message=Message(role="assistant", content=None),
                )
            ],
            usage=Usage(
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

    def test_parse_output_without_usage(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-no-usage",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[
                Choices(
                    index=0,
                    finish_reason="stop",
                    message=Message(role="assistant", content="Response without usage"),
                )
            ],
            usage=None,
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Response without usage"
        assert usage.prompt_tokens == 0
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 0

    def test_parse_output_with_zero_usage(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-zero",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[
                Choices(
                    index=0,
                    finish_reason="stop",
                    message=Message(role="assistant", content="Zero usage response"),
                )
            ],
            usage=Usage(
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Zero usage response"
        assert usage.prompt_tokens == 0
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 0

    def test_parse_output_with_multiple_choices(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-multi",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[
                Choices(
                    index=0,
                    finish_reason="stop",
                    message=Message(role="assistant", content="First choice"),
                ),
                Choices(
                    index=1,
                    finish_reason="stop",
                    message=Message(role="assistant", content="Second choice"),
                ),
            ],
            usage=Usage(
                prompt_tokens=15,
                completion_tokens=8,
                total_tokens=23,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        # Should return the first choice
        assert text == "First choice"
        assert usage.prompt_tokens == 15
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 23

    def test_parse_output_empty_response(self, model: LiteLLMModel) -> None:
        response = ModelResponse(
            id="chatcmpl-empty-choices",
            model="gpt-4o-mini",
            created=1677652288,
            choices=[],
            usage=Usage(
                prompt_tokens=3,
                completion_tokens=0,
                total_tokens=3,
            ),
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage.prompt_tokens == 3
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 3
