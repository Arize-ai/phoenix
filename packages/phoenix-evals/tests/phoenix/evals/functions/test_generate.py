import json
import sys
from math import isnan
from typing import Dict

import httpx
import numpy as np
import pandas as pd
import pytest
import respx
from phoenix.evals import OpenAIModel, llm_generate
from phoenix.evals.models.litellm import LiteLLMModel
from phoenix.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME
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

    model = OpenAIModel()

    generated = llm_generate(dataframe=dataframe, template=template, model=model)
    assert generated.iloc[:, 0].tolist() == responses


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_generate_with_included_prompts_and_responses(
    monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock
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

    model = OpenAIModel()

    generated = llm_generate(
        dataframe=dataframe,
        template=template,
        model=model,
        include_prompt=True,
        include_response=True,
    )
    assert generated["output"].tolist() == responses
    assert all("and a golden answer" in prompt for prompt in generated["prompt"].tolist())
    assert generated["response"].tolist() == responses


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

    model = OpenAIModel()

    def output_parser(response: str, response_index: int) -> Dict[str, str]:
        try:
            res = json.loads(response)
            res["category"] += str(response_index)
            return res
        except json.JSONDecodeError as e:
            return {"__error__": str(e)}

    generated = llm_generate(
        dataframe=dataframe, template=template, model=model, output_parser=output_parser
    )
    # check the output is parsed correctly
    assert generated["category"].tolist() == [
        "programming0",
        "programming1",
        "programming2",
        "programming3",
        np.nan,
    ]

    # check the unparsable response captures the error
    assert generated["__error__"].tolist() == [np.nan] * 4 + [
        "Expecting value: line 1 column 1 (char 0)"
    ]


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_generate_tolerance_to_exceptions(
    monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock, capfd
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel()
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
        "gobbledygook",
    ]
    dataframe.index = ["python1", "python2", "cpp1", "cpp2", "gibberish"]

    queries = dataframe["query"].tolist()
    for query, response in zip(queries, responses):
        matcher = M(content__contains=query)
        # Simulate an error on the second query
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    df = llm_generate(
        dataframe=dataframe,
        template="Given {query}, generate output",
        model=model,
    )

    assert df is not None
    # Make sure there is a logger.error output
    captured = capfd.readouterr()
    assert "Exception in worker" in captured.out
    assert df["output"].tolist() == [
        '{ "category": "programming", "language": "Python" }',
        '{ "category": "programming", "language": "Python" }',
        "generation-failed",
        "generation-failed",
        "gobbledygook",
    ]
    assert df.index.tolist() == dataframe.index.tolist()


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_generate_properly_mixes_column_outputs(
    monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock, capfd
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel()
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
        "gobbledygook",
    ]
    dataframe.index = ["python1", "python2", "cpp1", "cpp2", "gibberish"]

    queries = dataframe["query"].tolist()
    for query, response in zip(queries, responses):
        matcher = M(content__contains=query)
        # Simulate an error on the second query
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    df = llm_generate(
        dataframe=dataframe,
        template="Given {query}, generate output",
        model=model,
        output_parser=lambda x, y: {"response": x},  # rename the output column to "response"
    )

    assert df is not None
    # Make sure there is a logger.error output
    captured = capfd.readouterr()
    assert "Exception in worker" in captured.out

    # the "response" column should contain the successfully returned responses
    response_column = df["response"].tolist()
    assert response_column[0] == '{ "category": "programming", "language": "Python" }'
    assert response_column[1] == '{ "category": "programming", "language": "Python" }'
    assert isnan(response_column[2])
    assert isnan(response_column[3])
    assert response_column[4] == "gobbledygook"

    # the error messages fall back to the "output" column
    output_column = df["output"].tolist()
    assert isnan(output_column[0])
    assert isnan(output_column[1])
    assert output_column[2] == "generation-failed"
    assert output_column[3] == "generation-failed"
    assert isnan(output_column[4])

    assert df.index.tolist() == dataframe.index.tolist()


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="https://github.com/BerriAI/litellm/issues/2005",
)
def test_litellm_model_llm_generate(monkeypatch: pytest.MonkeyPatch):
    """LiteLLM can return a `mock_response` from completion, we set it in model_kwargs to True"""

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
    responses = ["True", "True", "True", "True"]

    template = (
        "Given {query} and a golden answer {reference}, generate an answer that returns True."
    )

    model = LiteLLMModel(model="gpt-3.5-turbo", model_kwargs={"mock_response": True})

    generated = llm_generate(dataframe=dataframe, template=template, model=model)
    assert generated.iloc[:, 0].tolist() == responses
