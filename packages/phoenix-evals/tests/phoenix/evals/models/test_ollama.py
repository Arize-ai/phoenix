import os
import unittest
from unittest import mock

from models import LiteLLMModel


@mock.patch.dict(os.environ, {"OLLAMA_API_BASE": "just to make litellm.validate_environment happy"}, clear=True)
@mock.patch("litellm.llms.ollama.get_ollama_response")
def test_selfhosted_ollama_via_model_kwargs(get_ollama_response):
    ollama_response = unittest.mock.MagicMock()
    ollama_response["choices"][0]["message"]["content"] = "barely understand Python mocks"
    ollama_response.choices[0].message.content = "42 per tail"

    get_ollama_response.return_value = ollama_response

    lllmm = LiteLLMModel(model="ollama/monstral",
                         model_kwargs=dict(
                             base_url="http://hosted.olla.ma:11434"))
    result = lllmm("How much is the fish?")

    assert result == "42 per tail"
    call_args = get_ollama_response.call_args[0]
    assert call_args[0] == "http://hosted.olla.ma:11434"
    assert call_args[1] == "monstral"
    assert "How much is the fish?" in call_args[2]


@mock.patch.dict(os.environ, {"OLLAMA_API_BASE": "http://hosted.olla.ma:11434"}, clear=True)
@mock.patch("litellm.llms.ollama.get_ollama_response")
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
