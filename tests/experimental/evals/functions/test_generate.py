import json
from typing import Dict
from unittest.mock import patch

import httpx
import numpy as np
import pandas as pd
import pytest
import respx
from phoenix.experimental.evals import OpenAIModel, llm_generate
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME
from respx.patterns import M


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
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
    queries = dataframe["query"].tolist()
    references = dataframe["reference"].tolist()
    for query, reference, response in zip(queries, references, responses):
        matcher = M(content__contains=query) & M(content__contains=reference)
        respx_mock.route(matcher).mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        )

    template = (
        "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
    )

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    generated = llm_generate(dataframe=dataframe, template=template, model=model)
    assert generated.iloc[:, 0].tolist() == responses


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
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
    queries = dataframe["query"].tolist()
    references = dataframe["reference"].tolist()
    for query, reference, response in zip(queries, references, responses):
        matcher = M(content__contains=query) & M(content__contains=reference)
        respx_mock.route(matcher).mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        )

    template = (
        "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
    )

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    llm_generate(dataframe=dataframe, template=template, model=model, verbose=True)

    out, _ = capfd.readouterr()
    assert "Generating responses for 4 prompts..." in out, "Response generation should be printed"


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_generate_with_output_parser(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
            },
            {
                "query": "What is Python?",
            },
            {
                "query": "What is C++?",
            },
            {
                "query": "What is C++?",
            },
            {
                "query": "gobbledygook",
            },
        ]
    )
    responses = [
        '{ "category": "programming", "language": "Python" }',
        '{ "category": "programming", "language": "Python" }',
        '{ "category": "programming", "language": "C++" }',
        '{ "category": "programming", "language": "C++" }',
        "unparsable response",
    ]
    queries = dataframe["query"].tolist()

    for query, response in zip(queries, responses):
        matcher = M(content__contains=query) & M(content__contains=query)
        respx_mock.route(matcher).mock(
            return_value=httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        )

    template = "Given {query}, generate output"

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    def output_parser(response: str) -> Dict[str, str]:
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            return {"__error__": str(e)}

    generated = llm_generate(
        dataframe=dataframe, template=template, model=model, output_parser=output_parser
    )
    # check the output is parsed correctly
    assert generated["category"].tolist() == [
        "programming",
        "programming",
        "programming",
        "programming",
        np.nan,
    ]

    # check the unparsable response captures the error
    assert generated["__error__"].tolist() == [np.nan] * 4 + [
        "Expecting value: line 1 column 1 (char 0)"
    ]
