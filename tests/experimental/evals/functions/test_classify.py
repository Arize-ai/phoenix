from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import httpx
import numpy as np
import pandas as pd
import pytest
import respx
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    OpenAIModel,
    llm_classify,
    run_relevance_eval,
)
from phoenix.experimental.evals.functions.classify import _snap_to_rail
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME

response_labels = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]


def get_dataframe() -> (pd.DataFrame, list):
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
            {"query": "What is C++?", "reference": "C++ is a programming language."},
            {"query": "What is C++?", "reference": "irrelevant"},
        ],
    )
    index = list(reversed(range(len(dataframe))))
    dataframe = dataframe.set_axis(index, axis=0)
    return dataframe, index


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_llm_classify(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    def route_side_effect(request, route):
        return httpx.Response(
            200, json={"choices": [{"message": {"content": response_labels[route.call_count]}}]}
        )

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

    dataframe, index = get_dataframe()
    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        use_function_calling_if_available=False,
    )
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(
            index=index,
            data={"label": expected_labels},
        ),
    )
    del result


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_llm_classify_with_fn_call(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    def route_side_effect(request, route):
        label = response_labels[route.call_count]
        return httpx.Response(
            200,
            json={"choices": [{"message": {"function_call": {"arguments": {"response": label}}}}]},
        )

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

    dataframe, index = get_dataframe()
    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
    )

    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(result, pd.DataFrame(index=index, data={"label": expected_labels}))
    del result


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_classify_fn_call_no_explain(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    def route_side_effect(request, route):
        label = response_labels[route.call_count]
        message = {"function_call": {"arguments": {"response": label}}}
        return httpx.Response(201, json={"choices": [{"message": message}]})

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

    dataframe, index = get_dataframe()
    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        provide_explanation=True,
    )
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(
            index=index, data={"label": expected_labels, "explanation": [None, None, None, None]}
        ),
    )
    del result


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_classify_fn_call_explain(monkeypatch: pytest.MonkeyPatch, respx_mock: respx.mock):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    def route_side_effect(request, route):
        label = response_labels[route.call_count]
        message = {
            "function_call": {
                "arguments": f"{{\n  \042response\042: \042{label}\042, \042explanation\042: \042{route.call_count}\042\n}}"  # noqa E501
            }
        }
        return httpx.Response(200, json={"choices": [{"message": message}]})

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

    dataframe, index = get_dataframe()
    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        provide_explanation=True,
    )
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(
            index=index, data={"label": expected_labels, "explanation": ["0", "1", "2", "3"]}
        ),
    )
    del result


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_llm_classify_prints_to_stdout_with_verbose_flag(
    monkeypatch: pytest.MonkeyPatch, capfd, respx_mock: respx.mock
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    def route_side_effect(request, route):
        label = response_labels[route.call_count]
        return httpx.Response(200, json={"choices": [{"message": {"content": label}}]})

    respx_mock.post(
        "/chat/completions",
    ).mock(side_effect=route_side_effect)

    dataframe, index = get_dataframe()
    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        verbose=True,
        use_function_calling_if_available=False,
    )

    out, _ = capfd.readouterr()
    assert "Snapped 'relevant' to rail: relevant" in out, "Snapping events should be printed"
    assert "Snapped 'irrelevant' to rail: irrelevant" in out, "Snapping events should be printed"
    assert "Snapped '\\nrelevant ' to rail: relevant" in out, "Snapping events should be printed"
    assert "Cannot snap 'unparsable' to rails" in out, "Snapping events should be printed"
    assert "OpenAI invocation parameters" in out, "Model-specific information should be printed"
    assert "'model': 'gpt-4', 'temperature': 0.0" in out, "Model information should be printed"
    assert "sk-0123456789" not in out, "Credentials should not be printed out in cleartext"


def test_llm_classify_shows_retry_info_with_verbose_flag(monkeypatch: pytest.MonkeyPatch, capfd):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
                "reference": "Python is a programming language.",
            },
        ]
    )

    model = OpenAIModel(max_retries=5)

    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    openai_retry_errors = [
        model._openai.APITimeoutError("test timeout"),
        model._openai.APIError(
            message="test api error",
            request=httpx.request,
            body={},
        ),
        model._openai.APIConnectionError(message="test api connection error", request=request),
        model._openai.RateLimitError(
            "test rate limit error",
            response=httpx.Response(status_code=419, request=request),
            body={},
        ),
        model._openai.InternalServerError(
            "test internal server error",
            response=httpx.Response(status_code=500, request=request),
            body={},
        ),
    ]
    mock_openai = MagicMock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._client.chat.completions, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai.InternalServerError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
            verbose=True,
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" in out, "Retry information should be printed"
    assert "Request timed out" in out, "Retry information should be printed"
    assert "Failed attempt 2" in out, "Retry information should be printed"
    assert "test api error" in out, "Retry information should be printed"
    assert "Failed attempt 3" in out, "Retry information should be printed"
    assert "test api connection error" in out, "Retry information should be printed"
    assert "Failed attempt 4" in out, "Retry information should be printed"
    assert "test rate limit error" in out, "Retry information should be printed"
    assert "Failed attempt 5" not in out, "Maximum retries should not be exceeded"


def test_llm_classify_does_not_persist_verbose_flag(monkeypatch: pytest.MonkeyPatch, capfd):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
                "reference": "Python is a programming language.",
            },
        ]
    )

    model = OpenAIModel(max_retries=2)

    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    openai_retry_errors = [
        model._openai.APITimeoutError("test timeout"),
        model._openai.APIError(
            message="test api error",
            request=request,
            body={},
        ),
    ]
    mock_openai = MagicMock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._client.chat.completions, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai.OpenAIError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
            verbose=True,
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" in out, "Retry information should be printed"
    assert "Request timed out" in out, "Retry information should be printed"
    assert "Failed attempt 2" not in out, "Retry information should be printed"

    mock_openai.reset_mock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._client.chat.completions, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai.APIError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" not in out, "The `verbose` flag should not be persisted"
    assert "Request timed out" not in out, "The `verbose` flag should not be persisted"


@pytest.mark.respx(base_url="https://api.openai.com/v1")
@pytest.mark.parametrize(
    "dataframe",
    [
        pytest.param(
            pd.DataFrame(
                [
                    {
                        "attributes.input.value": "What is Python?",
                        "attributes.retrieval.documents": [
                            "Python is a programming language.",
                            "Ruby is a programming language.",
                        ],
                    },
                    {
                        "attributes.input.value": "What is Python?",
                        "attributes.retrieval.documents": np.array(
                            [
                                "Python is a programming language.",
                                "Ruby is a programming language.",
                            ]
                        ),
                    },
                    {
                        "attributes.input.value": "What is Ruby?",
                        "attributes.retrieval.documents": [
                            "Ruby is a programming language.",
                        ],
                    },
                    {
                        "attributes.input.value": "What is C++?",
                        "attributes.retrieval.documents": [
                            "Ruby is a programming language.",
                            "C++ is a programming language.",
                        ],
                    },
                    {
                        "attributes.input.value": "What is C#?",
                        "attributes.retrieval.documents": [],
                    },
                    {
                        "attributes.input.value": "What is Golang?",
                        "attributes.retrieval.documents": None,
                    },
                    {
                        "attributes.input.value": None,
                        "attributes.retrieval.documents": [
                            "Python is a programming language.",
                            "Ruby is a programming language.",
                        ],
                    },
                    {
                        "attributes.input.value": None,
                        "attributes.retrieval.documents": None,
                    },
                ]
            ),
            id="standard-dataframe",
        ),
        pytest.param(
            pd.DataFrame(
                [
                    {
                        "attributes.input.value": "What is Python?",
                        "attributes.retrieval.documents": [
                            {"document.content": "Python is a programming language."},
                            {"document.content": "Ruby is a programming language."},
                        ],
                    },
                    {
                        "attributes.input.value": "What is Python?",
                        "attributes.retrieval.documents": np.array(
                            [
                                {"document.content": "Python is a programming language."},
                                {"document.content": "Ruby is a programming language."},
                            ]
                        ),
                    },
                    {
                        "attributes.input.value": "What is Ruby?",
                        "attributes.retrieval.documents": [
                            {"document.content": "Ruby is a programming language."},
                        ],
                    },
                    {
                        "attributes.input.value": "What is C++?",
                        "attributes.retrieval.documents": [
                            {"document.content": "Ruby is a programming language."},
                            {"document.content": "C++ is a programming language."},
                        ],
                    },
                    {
                        "attributes.input.value": "What is C#?",
                        "attributes.retrieval.documents": [],
                    },
                    {
                        "attributes.input.value": "What is Golang?",
                        "attributes.retrieval.documents": None,
                    },
                    {
                        "attributes.input.value": None,
                        "attributes.retrieval.documents": [
                            {"document.content": "Python is a programming language."},
                            {"document.content": "Ruby is a programming language."},
                        ],
                    },
                    {
                        "attributes.input.value": None,
                        "attributes.retrieval.documents": None,
                    },
                ]
            ),
            id="openinference-dataframe",
        ),
    ],
)
def test_run_relevance_eval(
    monkeypatch: pytest.MonkeyPatch,
    dataframe: pd.DataFrame,
    respx_mock: respx.mock,
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    responses = [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
        "relevant",
    ]

    def route_side_effect(request, route):
        return httpx.Response(
            200, json={"choices": [{"message": {"content": responses[route.call_count]}}]}
        )

    respx_mock.post(
        "/chat/completions",
    ).mock(
        side_effect=route_side_effect,
    )
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()
    relevance_classifications = run_relevance_eval(dataframe, model=model)
    assert relevance_classifications == [
        ["relevant", "irrelevant"],
        ["relevant", "irrelevant"],
        ["relevant"],
        [NOT_PARSABLE, "relevant"],
        [],
        [],
        [],
        [],
    ]


def test_overlapping_rails():
    assert _snap_to_rail("irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    assert _snap_to_rail("relevant", ["relevant", "irrelevant"]) == "relevant"
    assert _snap_to_rail("irrelevant...", ["irrelevant", "relevant"]) == "irrelevant"
    assert _snap_to_rail("...irrelevant", ["irrelevant", "relevant"]) == "irrelevant"
    # Both rails are present, cannot parse
    assert _snap_to_rail("relevant...irrelevant", ["irrelevant", "relevant"]) is NOT_PARSABLE
    assert _snap_to_rail("Irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    # One rail appears twice
    assert _snap_to_rail("relevant...relevant", ["irrelevant", "relevant"]) == "relevant"
    assert _snap_to_rail("b b", ["a", "b", "c"]) == "b"
    # More than two rails
    assert _snap_to_rail("a", ["a", "b", "c"]) == "a"
    assert _snap_to_rail(" abc", ["a", "ab", "abc"]) == "abc"
    assert _snap_to_rail("abc", ["abc", "a", "ab"]) == "abc"
