from unittest.mock import patch

import pandas as pd
import pytest
import responses
from aioresponses import CallbackResult, aioresponses
from phoenix.experimental.evals import OpenAIModel, llm_generate
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME


@pytest.fixture
@responses.activate
def mock_ratelimit_inspection():
    # Mock OpenAI API request used for reading the rate limit
    headers = {"x-ratelimit-limit-requests": "100_000", "x-ratelimit-limit-tokens": "100_000"}
    responses.add(
        responses.POST,
        "https://api.openai.com/v1/chat/completions",
        json={},
        status=200,
        headers=headers,
    )
    return responses


def test_llm_generate(mock_ratelimit_inspection, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
                "reference": "Python is a programming language.",
            },
            {
                "query": "What is Python?",
                "reference": "Ruby is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "C++ is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "irrelevant",
            },
        ]
    )

    keys = list(zip(dataframe["query"], dataframe["reference"]))
    responses = [
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
    ]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    def response_callback(url, **kwargs):
        request_body = kwargs["data"].decode("utf-8")

        for key in response_mapping:
            query, reference = key
            response = ""
            if query in request_body and reference in request_body:
                response = response_mapping.pop(
                    key
                )  # Remove the key-value pair to avoid reusing the same response
                break
        return CallbackResult(
            status=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "content": response,
                        },
                    }
                ],
                "usage": {
                    "total_tokens": 1,
                },
            },
        )

    with aioresponses() as mock_aiohttp:
        mock_aiohttp.post(
            "https://api.openai.com/v1/chat/completions",
            status=200,
            callback=response_callback,
            repeat=True,
        )
        template = (
            "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
        )

        with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
            model = OpenAIModel()

        generated = llm_generate(dataframe=dataframe, template=template, model=model)
        assert generated == [
            "it's a dialect of french",
            "it's a music notation",
            "It's a crazy language",
            "it's a programming language",
        ]


def test_llm_generate_prints_info_with_verbose_flag(
    mock_ratelimit_inspection, monkeypatch: pytest.MonkeyPatch, capfd
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
                "reference": "Python is a programming language.",
            },
            {
                "query": "What is Python?",
                "reference": "Ruby is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "C++ is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "irrelevant",
            },
        ]
    )

    keys = list(zip(dataframe["query"], dataframe["reference"]))
    responses = [
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
    ]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    def response_callback(url, **kwargs):
        request_body = kwargs["data"].decode("utf-8")

        for key in response_mapping:
            query, reference = key
            response = ""
            if query in request_body and reference in request_body:
                response = response_mapping.pop(
                    key
                )  # Remove the key-value pair to avoid reusing the same response
                break
        return CallbackResult(
            status=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "content": response,
                        },
                    }
                ],
                "usage": {
                    "total_tokens": 1,
                },
            },
        )

    with aioresponses() as mock_aiohttp:
        mock_aiohttp.post(
            "https://api.openai.com/v1/chat/completions",
            status=200,
            callback=response_callback,
            repeat=True,
        )
        template = (
            "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
        )

        with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
            model = OpenAIModel()

        llm_generate(dataframe=dataframe, template=template, model=model, verbose=True)

    out, _ = capfd.readouterr()
    assert "Generating responses for 4 prompts..." in out, "Response generation should be printed"
