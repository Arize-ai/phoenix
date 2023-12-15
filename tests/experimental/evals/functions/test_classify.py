import asyncio
import signal
from contextlib import ExitStack
from itertools import product
from typing import List
from unittest.mock import MagicMock, patch

import httpx
import nest_asyncio
import numpy as np
import pandas as pd
import phoenix
import pytest
import respx
from pandas.core.frame import DataFrame
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals import (
    NOT_PARSABLE,
    OpenAIModel,
    llm_classify,
    run_relevance_eval,
)
from phoenix.experimental.evals.evaluators import LLMEvaluator
from phoenix.experimental.evals.functions.classify import (
    AsyncExecutor,
    SyncExecutor,
    _snap_to_rail,
    get_executor_on_sync_context,
    run_evals,
)
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME
from phoenix.experimental.evals.templates.default_templates import (
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_TEMPLATE,
)
from respx.patterns import M


@pytest.fixture
def api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, api_key)
    return api_key


@pytest.fixture
def model(api_key: str) -> OpenAIModel:
    return OpenAIModel(model_name="gpt-4")


@pytest.fixture
def toxicity_evaluator(model: OpenAIModel) -> LLMEvaluator:
    return LLMEvaluator(
        name="toxicity",
        template=TOXICITY_PROMPT_TEMPLATE,
        model=model,
        verbose=True,
    )


@pytest.fixture
def relevance_evaluator(model: OpenAIModel) -> LLMEvaluator:
    return LLMEvaluator(
        name="relevance",
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        verbose=True,
    )


@pytest.fixture
def running_event_loop_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "phoenix.experimental.evals.functions.classify._running_event_loop_exists",
        lambda: True,
    )
    assert (
        phoenix.experimental.evals.functions.classify._running_event_loop_exists()
    ), "mock for detecting event loop should return True"


@pytest.fixture
def classification_dataframe():
    return pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": "Python is a programming language.",
            },
            {
                "input": "What is Python?",
                "reference": "Ruby is a programming language.",
            },
            {"input": "What is C++?", "reference": "C++ is a programming language."},
            {"input": "What is C++?", "reference": "irrelevant"},
        ],
    )


@pytest.fixture
def classification_responses():
    return [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
    ]


@pytest.fixture
def classification_template():
    return RAG_RELEVANCY_PROMPT_TEMPLATE


async def test_executor_factory_returns_sync_in_async_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    async def executor_in_async_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = await executor_in_async_context()
    assert isinstance(executor, SyncExecutor)


async def test_executor_factory_returns_async_in_patched_async_context():
    nest_asyncio.apply()

    def sync_fn():
        pass

    async def async_fn():
        pass

    async def executor_in_async_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = await executor_in_async_context()
    assert isinstance(executor, AsyncExecutor)


def test_executor_factory_returns_async_in_sync_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    def executor_in_sync_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = executor_in_sync_context()
    assert isinstance(executor, AsyncExecutor)


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify(
    api_key: str,
    classification_dataframe: DataFrame,
    respx_mock: respx.mock,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [
                {
                    "message": {
                        "content": response,
                    },
                }
            ],
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
        verbose=True,
    )

    expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_with_async(
    api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [
                {
                    "message": {
                        "content": response,
                    },
                }
            ],
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
        verbose=True,
    )

    expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_with_fn_call(
    api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [{"message": {"function_call": {"arguments": {"response": response}}}}]
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
    )

    expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(result, pd.DataFrame(data={"label": expected_labels}))


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_classify_fn_call_no_explain(
    api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [{"message": {"function_call": {"arguments": {"response": response}}}}]
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
        provide_explanation=True,
    )

    expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(data={"label": expected_labels, "explanation": [None, None, None, None]}),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_classify_fn_call_explain(
    api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for ii, ((query, reference), response) in enumerate(response_mapping.items()):
        matcher = M(content__contains=query) & M(content__contains=reference)
        message = {
            "function_call": {
                "arguments": f"{{\n  \042response\042: \042{response}\042, \042explanation\042: \042{ii}\042\n}}"  # noqa E501
            }
        }
        respx_mock.route(matcher).mock(
            return_value=httpx.Response(200, json={"choices": [{"message": message}]})
        )

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
        provide_explanation=True,
    )

    expected_labels = ["relevant", "irrelevant", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result,
        pd.DataFrame(data={"label": expected_labels, "explanation": ["0", "1", "2", "3"]}),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_prints_to_stdout_with_verbose_flag(
    classification_dataframe: DataFrame,
    api_key: str,
    respx_mock: respx.mock,
    capfd: pytest.CaptureFixture[str],
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "irrelevant", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {"choices": [{"message": {"content": response}}]}
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)

    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
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


def test_llm_classify_shows_retry_info(api_key: str, capfd: pytest.CaptureFixture[str]):
    dataframe = pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": "Python is a programming language.",
            },
        ]
    )

    with ExitStack() as stack:
        waiting_fn = "phoenix.experimental.evals.models.base.wait_random_exponential"
        stack.enter_context(patch(waiting_fn, return_value=False))
        model = OpenAIModel(max_retries=4)

        request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        openai_retry_errors = [
            model._openai.APITimeoutError("test timeout"),
            model._openai.APIError(
                message="test api error",
                request=httpx.request,
                body={},
            ),
            model._openai.APIConnectionError(message="test api connection error", request=request),
            model._openai.InternalServerError(
                "test internal server error",
                response=httpx.Response(status_code=500, request=request),
                body={},
            ),
        ]
        mock_openai = MagicMock()
        mock_openai.side_effect = openai_retry_errors
        stack.enter_context(
            patch.object(model._async_client.chat.completions, "create", mock_openai)
        )
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE,
            model=model,
            rails=["relevant", "irrelevant"],
        )

    out, _ = capfd.readouterr()
    assert "Failed attempt 1" in out, "Retry information should be printed"
    assert "Failed attempt 2" in out, "Retry information should be printed"
    assert "Failed attempt 3" in out, "Retry information should be printed"
    assert "Failed attempt 4" not in out, "Maximum retries should not be exceeded"


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_relevance_eval_standard_dataframe(
    api_key: str,
    respx_mock: respx.mock,
):
    dataframe = pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": [
                    "Python is a programming language.",
                    "Ruby is a programming language.",
                ],
            },
            {
                "input": "Can you explain Python to me?",
                "reference": np.array(
                    [
                        "Python is a programming language.",
                        "Ruby is a programming language.",
                    ]
                ),
            },
            {
                "input": "What is Ruby?",
                "reference": [
                    "Ruby is a programming language.",
                ],
            },
            {
                "input": "What is C++?",
                "reference": [
                    "Ruby is a programming language.",
                    "C++ is a programming language.",
                ],
            },
            {
                "input": "What is C#?",
                "reference": [],
            },
            {
                "input": "What is Golang?",
                "reference": None,
            },
            {
                "input": None,
                "reference": [
                    "Python is a programming language.",
                    "Ruby is a programming language.",
                ],
            },
            {
                "input": None,
                "reference": None,
            },
        ]
    )

    queries = list(dataframe["input"])
    references = list(dataframe["reference"])
    keys = []
    for query, refs in zip(queries, references):
        refs = refs if refs is None else list(refs)
        if query and refs:
            keys.extend(product([query], refs))

    responses = [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
        "relevant",
    ]

    response_mapping = {key: response for key, response in zip(keys, responses)}
    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
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
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

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


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_classify_tolerance_to_exceptions(
    api_key: str,
    classification_dataframe: pd.DataFrame,
    classification_responses: List[str],
    classification_template: str,
    respx_mock: respx.mock,
    capfd,
):
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(max_retries=0)
    queries = classification_dataframe["input"].tolist()
    for query, response in zip(queries, classification_responses):
        matcher = M(content__contains=query)
        # Simulate an error on the second query
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    classification_df = llm_classify(
        dataframe=classification_dataframe,
        template=classification_template,
        model=model,
        rails=["relevant", "irrelevant"],
    )

    assert classification_df is not None
    # Make sure there is a logger.error output
    captured = capfd.readouterr()
    assert "Exception in worker" in captured.out


def test_run_relevance_eval_openinference_dataframe(
    api_key: str,
    respx_mock: respx.mock,
):
    dataframe = pd.DataFrame(
        [
            {
                "attributes.input.value": "What is Python?",
                "attributes.retrieval.documents": [
                    {"document.content": "Python is a programming language."},
                    {"document.content": "Ruby is a programming language."},
                ],
            },
            {
                "attributes.input.value": "Can you explain Python to me?",
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
    )

    queries = list(dataframe["attributes.input.value"])
    references = list(dataframe["attributes.retrieval.documents"])
    keys = []
    for query, refs in zip(queries, references):
        refs = refs if refs is None else list(refs)
        if query and refs:
            keys.extend(product([query], refs))
    keys = [(query, ref["document.content"]) for query, ref in keys]

    responses = [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
        "relevant",
    ]

    response_mapping = {key: response for key, response in zip(keys, responses)}
    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
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
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

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


async def test_async_executor_executes():
    async def dummy_fn(payload: int) -> int:
        return payload - 1

    executor = AsyncExecutor(dummy_fn, concurrency=10)
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 2, 3, 4]


async def test_async_executor_executes_many_tasks():
    async def dummy_fn(payload: int) -> int:
        return payload

    executor = AsyncExecutor(dummy_fn, concurrency=10)
    inputs = [x for x in range(1000)]
    outputs = await executor.execute(inputs)
    assert outputs == inputs


def test_async_executor_runs_synchronously():
    async def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = AsyncExecutor(dummy_fn, concurrency=10)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


async def test_async_executor_execute_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(dummy_fn, concurrency=1, exit_on_error=True, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 52, 52, 52]


def test_async_executor_run_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(dummy_fn, concurrency=1, exit_on_error=True, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 52, 52]


async def test_async_executor_can_continue_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(dummy_fn, concurrency=1, exit_on_error=False, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 52, 3, 4]


async def test_async_executor_sigint_handling():
    async def async_fn(x):
        await asyncio.sleep(0.01)
        return x

    executor = AsyncExecutor(async_fn, concurrency=5, fallback_return_value="test")

    # Run the executor with a large number of inputs
    task = asyncio.create_task(executor.execute(list(range(100))))
    await asyncio.sleep(0.1)

    # Simulate a SIGINT signal
    executor._signal_handler(signal.SIGINT, None)
    results = await task

    assert len(results) == 100
    assert results.count("test") > 0, "some inputs should not have been processed"


def test_sync_executor_runs_many_tasks():
    def dummy_fn(payload: int) -> int:
        return payload

    executor = SyncExecutor(dummy_fn)
    inputs = [x for x in range(1000)]
    outputs = executor.run(inputs)
    assert outputs == inputs


def test_sync_executor_runs():
    def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = SyncExecutor(dummy_fn)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


def test_sync_executor_run_exits_early_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=True, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 52, 52]


def test_sync_executor_can_continue_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=False, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 3, 4]


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_produces_expected_output_dataframe_when_no_running_event_loop_exists(
    respx_mock: respx.mock, toxicity_evaluator: LLMEvaluator, relevance_evaluator: LLMEvaluator
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France.")
            & M(content__contains="relevant"),
            "relevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany.")
            & M(content__contains="relevant"),
            "irrelevant",
        ),
        (
            M(content__contains="What is the capital of France?") & M(content__contains="toxic"),
            "non-toxic",
        ),
    ]:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": response,
                    },
                }
            ],
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    df = pd.DataFrame(
        [
            {
                "input": "What is the capital of France?",
                "reference": "Paris is the capital of France.",
            },
            {
                "input": "What is the capital of France?",
                "reference": "Munich is the capital of Germany.",
            },
        ],
        index=["a", "b"],
    )
    eval_df = run_evals(dataframe=df, evaluators=[relevance_evaluator, toxicity_evaluator])
    assert_frame_equal(
        eval_df,
        pd.DataFrame(
            {"relevance": ["relevant", "irrelevant"], "toxicity": ["non-toxic", "non-toxic"]},
            index=["a", "b"],
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_produces_expected_output_dataframe_when_running_event_loop_already_exists(
    running_event_loop_mock,
    respx_mock: respx.mock,
    toxicity_evaluator: LLMEvaluator,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France.")
            & M(content__contains="relevant"),
            "relevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany.")
            & M(content__contains="relevant"),
            "irrelevant",
        ),
        (
            M(content__contains="What is the capital of France?") & M(content__contains="toxic"),
            "non-toxic",
        ),
    ]:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": response,
                    },
                }
            ],
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    df = pd.DataFrame(
        [
            {
                "input": "What is the capital of France?",
                "reference": "Paris is the capital of France.",
            },
            {
                "input": "What is the capital of France?",
                "reference": "Munich is the capital of Germany.",
            },
        ],
        index=["a", "b"],
    )
    eval_df = run_evals(dataframe=df, evaluators=[relevance_evaluator, toxicity_evaluator])
    assert_frame_equal(
        eval_df,
        pd.DataFrame(
            {"relevance": ["relevant", "irrelevant"], "toxicity": ["non-toxic", "non-toxic"]},
            index=["a", "b"],
        ),
    )


def test_run_evals_with_evaluators_with_duplicate_names_raises_value_error(
    toxicity_evaluator: LLMEvaluator,
) -> None:
    with pytest.raises(ValueError):
        run_evals(
            dataframe=pd.DataFrame(),
            evaluators=[toxicity_evaluator, toxicity_evaluator],
        )
