import unittest
from unittest import mock
from phoenix.evals.models.openai import OpenAIModel


@mock.patch("openai.resources.chat.completions.Completions.create")
def test_selfhosted_openai(completions_create):
    completion = unittest.mock.MagicMock()
    completion.model_dump.return_value = {"choices": [{"message": {"function_call": False, "content": "42 per tail"}}]}
    completions_create.return_value = completion

    lllmm = OpenAIModel(model="monstral",
                        base_url="http://hosted.openai.me:8000/v1",
                        api_key="bogus")
    result = lllmm("How much is the fish?")

    assert result == "42 per tail"
    call_args = completions_create.call_args[1]
    assert str(lllmm._client.base_url) == "http://hosted.openai.me:8000/v1/"
    assert call_args["model"] == "monstral"
    assert call_args["messages"][0]["content"] == "How much is the fish?"
