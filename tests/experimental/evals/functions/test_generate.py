from unittest.mock import patch

import httpx
import pandas as pd
import pytest
import respx
from phoenix.experimental.evals import OpenAIModel, llm_generate
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_llm_generate(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
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
    responses = [
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
    ]

    def route_side_effect(request, route):
        return httpx.Response(
            200, json={"choices": [{"message": {"content": responses[route.call_count]}}]}
        )

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

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


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_llm_generate_prints_info_with_verbose_flag(
    monkeypatch: pytest.MonkeyPatch, capfd, respx_mock: respx.mock
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
    responses = [
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
    ]

    def route_side_effect(request, route):
        return httpx.Response(
            200, json={"choices": [{"message": {"content": responses[route.call_count]}}]}
        )

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)
    template = (
        "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
    )

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    llm_generate(dataframe=dataframe, template=template, model=model, verbose=True)

    out, _ = capfd.readouterr()
    assert "Generating responses for 4 prompts..." in out, "Response generation should be printed"
