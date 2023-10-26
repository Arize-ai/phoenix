from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
import responses
from phoenix.experimental.evals import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    OpenAIModel,
    llm_classify,
    llm_classify_with_explanation,
    run_relevance_eval,
)
from phoenix.experimental.evals.functions.classify import _snap_to_rail
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME


@responses.activate
def test_llm_classify_with_explanation(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {"query": "What is Python?", "reference": "Python is a programming language."},
            {"query": "What is Python?", "reference": "Ruby is a programming language."},
            {"query": "What is C++?", "reference": "C++ is a programming language."},
            {"query": "What is C++?", "reference": "irrelevant"},
        ]
    )
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    # without function call in response
    for message_content in ["relevant", "irrelevant", "\nrelevant ", "unparsable"]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={"choices": [{"message": {"content": message_content}}]},
            status=200,
        )
    relevance_classifications = llm_classify_with_explanation(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
    )
    labels = [result.label for result in relevance_classifications]
    assert labels == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]

    # function call without explanation
    for message_content in ["relevant", "irrelevant", "\nrelevant ", "unparsable"]:
        message = {
            "function_call": {
                "arguments": f"{{\n  \042response\042: \042{message_content}\042\n}}",
            }
        }
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={"choices": [{"message": message}]},
            status=200,
        )
    relevance_classifications = llm_classify_with_explanation(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
    )
    labels = [result.label for result in relevance_classifications]
    assert labels == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    explanations = [result.explanation for result in relevance_classifications]
    assert explanations == [None, None, None, None]

    # function call with explanation
    for i, message_content in enumerate(["relevant", "irrelevant", "\nrelevant ", "unparsable"]):
        message = {
            "function_call": {
                "arguments": f"{{\n  \042response\042: \042{message_content}\042, \042explanation\042: \042{i}\042\n}}"  # noqa E501
            }
        }
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={"choices": [{"message": message}]},
            status=200,
        )
    relevance_classifications = llm_classify_with_explanation(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
    )
    labels = [result.label for result in relevance_classifications]
    assert labels == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    explanations = [result.explanation for result in relevance_classifications]
    assert explanations == ["0", "1", "2", "3"]


@responses.activate
def test_llm_classify(monkeypatch: pytest.MonkeyPatch):
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
    for message_content in [
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
    ]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "choices": [
                    {
                        "message": {
                            "content": message_content,
                        },
                    }
                ],
            },
            status=200,
        )
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    relevance_classifications = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        verbose=True,
    )
    assert relevance_classifications == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]

    for message_content in ["relevant", "irrelevant", "\nrelevant ", "unparsable"]:
        message = {"function_call": {"arguments": f"{{\n  'response': {message_content}\n}}"}}
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={"choices": [{"message": message}]},
            status=200,
        )
    relevance_classifications = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
    )
    assert relevance_classifications == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]


@responses.activate
def test_llm_classify_prints_to_stdout_with_verbose_flag(monkeypatch: pytest.MonkeyPatch, capfd):
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
    for message_content in [
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
    ]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "choices": [
                    {
                        "message": {
                            "content": message_content,
                        },
                    }
                ],
            },
            status=200,
        )
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=model,
        rails=["relevant", "irrelevant"],
        verbose=True,
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

    openai_retry_errors = [
        model._openai_error.Timeout("test timeout"),
        model._openai_error.APIError("test api error"),
        model._openai_error.APIConnectionError("test api connection error"),
        model._openai_error.RateLimitError("test rate limit error"),
        model._openai_error.ServiceUnavailableError("test service unavailable error"),
    ]
    mock_openai = MagicMock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._openai.ChatCompletion, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai_error.ServiceUnavailableError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
            verbose=True,
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" in out, "Retry information should be printed"
    assert "test timeout" in out, "Retry information should be printed"
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

    openai_retry_errors = [
        model._openai_error.Timeout("test timeout"),
        model._openai_error.APIError("test api error"),
    ]
    mock_openai = MagicMock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._openai.ChatCompletion, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai_error.APIError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
            verbose=True,
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" in out, "Retry information should be printed"
    assert "test timeout" in out, "Retry information should be printed"
    assert "Failed attempt 2" not in out, "Retry information should be printed"

    mock_openai.reset_mock()
    mock_openai.side_effect = openai_retry_errors

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        stack.enter_context(patch.object(OpenAIModel, "_init_tiktoken", return_value=None))
        stack.enter_context(patch.object(model._openai.ChatCompletion, "create", mock_openai))
        stack.enter_context(pytest.raises(model._openai_error.APIError))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
            model=model,
            rails=["relevant", "irrelevant"],
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" not in out, "The `verbose` flag should not be persisted"
    assert "test timeout" not in out, "The `verbose` flag should not be persisted"


@responses.activate
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
):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    for message_content in [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
        "relevant",
    ]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "choices": [
                    {
                        "message": {
                            "content": message_content,
                        },
                    }
                ],
            },
            status=200,
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
