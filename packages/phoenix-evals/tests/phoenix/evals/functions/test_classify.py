import json
from contextlib import ExitStack
from typing import List
from unittest.mock import MagicMock, patch

import httpx
import pandas as pd
import pytest
import respx
from pandas.core.frame import DataFrame
from pandas.testing import assert_frame_equal
from respx.patterns import M

import phoenix
from phoenix.evals import (
    NOT_PARSABLE,
    OpenAIModel,
    llm_classify,
)
from phoenix.evals.classify import (
    ClassificationStatus,
    run_evals,
)
from phoenix.evals.default_templates import (
    RAG_RELEVANCY_PROMPT_BASE_TEMPLATE,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_TEMPLATE_BASE_TEMPLATE,
)
from phoenix.evals.evaluators import LLMEvaluator
from phoenix.evals.executors import ExecutionStatus
from phoenix.evals.utils import _EXPLANATION, _FUNCTION_NAME, _RESPONSE


@pytest.fixture
def toxicity_evaluator(openai_model: OpenAIModel) -> LLMEvaluator:
    return LLMEvaluator(
        template=TOXICITY_PROMPT_TEMPLATE,
        model=openai_model,
    )


@pytest.fixture
def relevance_evaluator(openai_model: OpenAIModel) -> LLMEvaluator:
    return LLMEvaluator(
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=openai_model,
    )


@pytest.fixture(
    params=[
        pytest.param(True, id="running_event_loop_exists"),
        pytest.param(False, id="no_running_event_loop_exists"),
    ]
)
def running_event_loop_mock(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> bool:
    running_event_loop_exists = request.param
    monkeypatch.setattr(
        "phoenix.evals.executors._running_event_loop_exists",
        lambda: running_event_loop_exists,
    )
    assert (
        phoenix.evals.executors._running_event_loop_exists()
    ) is running_event_loop_exists, "mocked function should return the expected value"
    return running_event_loop_exists


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
            {"input": "What is C++?", "reference": "unrelated"},
        ],
    )


@pytest.fixture
def classification_responses():
    return [
        "relevant",
        "unrelated",
        "relevant",
        "unrelated",
    ]


@pytest.fixture
def classification_template():
    return RAG_RELEVANCY_PROMPT_TEMPLATE


@pytest.fixture
def mock_respx_responses(respx_mock: respx.mock):
    def _mock_responses(response_mapping):
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

    return _mock_responses


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    mock_respx_responses: mock_respx_responses,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    mock_respx_responses(response_mapping)

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_data_processor_dataframe(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    mock_respx_responses: mock_respx_responses,
):
    def row_flag_processor(row_series: pd.Series) -> pd.Series:
        if "C++" in row_series["reference"] or "Python" in row_series["reference"]:
            return pd.Series(
                {
                    "input": row_series["input"],
                    "reference": row_series["reference"] + " - FLAGGED",
                }
            )
        else:
            return row_series

    dataframe = classification_dataframe
    expected_dataframe = pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": "Python is a programming language." + " - FLAGGED",
            },
            {
                "input": "What is Python?",
                "reference": "Ruby is a programming language.",
            },
            {"input": "What is C++?", "reference": "C++ is a programming language." + " - FLAGGED"},
            {"input": "What is C++?", "reference": "unrelated"},
        ],
    )
    responses = ["relevant", "unrelated", "\nrelevant", "unparsable"]
    processed_keys = list(zip(expected_dataframe["input"], expected_dataframe["reference"]))
    processed_mapping = {key: response for key, response in zip(processed_keys, responses)}

    mock_respx_responses(processed_mapping)

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        data_processor=row_flag_processor,
        verbose=True,
        include_prompt=True,
    )

    for original_row, processed_prompt in zip(dataframe.itertuples(), result["prompt"].to_list()):
        inp = original_row.input
        ref = original_row.reference
        if "C++" in ref or "Python" in ref:
            assert (
                RAG_RELEVANCY_PROMPT_BASE_TEMPLATE.format(
                    input=inp,
                    reference=ref + " - FLAGGED",
                )
                == processed_prompt
            )
        else:
            assert (
                RAG_RELEVANCY_PROMPT_BASE_TEMPLATE.format(
                    input=inp,
                    reference=ref,
                )
                == processed_prompt
            )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_data_processor_list_of_tuples(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    mock_respx_responses: mock_respx_responses,
):
    def tuple_flag_processor(row_tuple: tuple) -> tuple:
        if "C++" in row_tuple[1] or "Python" in row_tuple[1]:
            return row_tuple[0], row_tuple[1] + " - FLAGGED"
        else:
            return row_tuple

    list_of_tuples = [
        ("What is Python?", "Python is a programming language."),
        ("What is Python?", "Ruby is a programming language."),
        ("What is C++?", "C++ is a programming language."),
        ("What is C++?", "unrelated"),
    ]
    processed_list_of_tuples = [
        ("What is Python?", "Python is a programming language." + " - FLAGGED"),
        ("What is Python?", "Ruby is a programming language."),
        ("What is C++?", "C++ is a programming language." + " - FLAGGED"),
        ("What is C++?", "unrelated"),
    ]

    responses = ["unparsable", "unparsable", "unparsable", "unparsable"]
    processed_keys = processed_list_of_tuples
    processed_mapping = {key: response for key, response in zip(processed_keys, responses)}

    mock_respx_responses(processed_mapping)

    model = OpenAIModel()

    result = llm_classify(
        dataframe=list_of_tuples,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        data_processor=tuple_flag_processor,
        verbose=True,
        include_prompt=True,
    )

    for original_tuple, processed_prompt in zip(list_of_tuples, result["prompt"].to_list()):
        inp = original_tuple[0]
        ref = original_tuple[1]
        if "C++" in ref or "Python" in ref:
            assert (
                RAG_RELEVANCY_PROMPT_BASE_TEMPLATE.format(
                    input=inp,
                    reference=ref + " - FLAGGED",
                )
                == processed_prompt
            )
        else:
            assert (
                RAG_RELEVANCY_PROMPT_BASE_TEMPLATE.format(
                    input=inp,
                    reference=ref,
                )
                == processed_prompt
            )

    expected_labels = [NOT_PARSABLE, NOT_PARSABLE, NOT_PARSABLE, NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_data_processor_list_of_strings(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    respx_mock: respx.mock,
):
    list_of_str = [
        "Python is a programming language.",
        "Your opinion is irrelevant and you should leave",
        "C++ is a programming language",
        "",
    ]
    processed_list_of_str = [
        "Python is a programming language.",
        "Your opinion is irrelevant and you should leave" + " - FLAGGED",
        "C++ is a programming language",
        "",
    ]
    responses = ["non-toxic", "toxic", "\nnon-toxic", "unparsable"]
    processed_keys = processed_list_of_str
    processed_mapping = {key: response for key, response in zip(processed_keys, responses)}

    def string_flag_processor(value: str) -> str:
        if "irrelevant" in value:
            return value + " - FLAGGED"
        return value

    for query, response in processed_mapping.items():
        matcher = M(content__contains=query)
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

    model = OpenAIModel()

    result = llm_classify(
        dataframe=list_of_str,
        template=TOXICITY_PROMPT_TEMPLATE,
        model=model,
        rails=["toxic", "non-toxic"],
        data_processor=string_flag_processor,
        include_prompt=True,
        verbose=True,
    )

    for original_str, processed_prompt in zip(list_of_str, result["prompt"].to_list()):
        if "irrelevant" in original_str:
            assert (
                TOXICITY_PROMPT_TEMPLATE_BASE_TEMPLATE.format(
                    input=original_str + " - FLAGGED",
                )
                == processed_prompt
            )
        else:
            assert (
                TOXICITY_PROMPT_TEMPLATE_BASE_TEMPLATE.format(
                    input=original_str,
                )
                == processed_prompt
            )

    expected_labels = ["non-toxic", "toxic", "non-toxic", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_data_and_no_dataframe_args(
    classification_dataframe: DataFrame,
    openai_api_key: str,
    mock_respx_responses: mock_respx_responses,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    mock_respx_responses(response_mapping)

    model = OpenAIModel()

    result = llm_classify(
        data=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_positional_args(
    classification_dataframe: DataFrame,
    openai_api_key: str,
    mock_respx_responses: mock_respx_responses,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    mock_respx_responses(response_mapping)

    model = OpenAIModel()

    result = llm_classify(
        dataframe,
        model,
        RAG_RELEVANCY_PROMPT_TEMPLATE,
        ["relevant", "unrelated"],
        verbose=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_data_positional_rest_keyword_args(
    classification_dataframe: DataFrame,
    openai_api_key: str,
    mock_respx_responses: mock_respx_responses,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    mock_respx_responses(response_mapping)

    model = OpenAIModel()

    result = llm_classify(
        classification_dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_positional_args_no_data(
    classification_dataframe: DataFrame,
    openai_api_key: str,
):
    model = OpenAIModel()

    with pytest.raises(
        TypeError, match=r"llm_classify\(\) missing 1 required positional argument: 'rails'"
    ):
        llm_classify(
            model,
            RAG_RELEVANCY_PROMPT_TEMPLATE,
            ["relevant", "unrelated"],
            verbose=True,
        )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_both_data_and_dataframe_args(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    mock_respx_responses: mock_respx_responses,
):
    dataframe = classification_dataframe
    alt_dataframe = pd.DataFrame(
        [
            {
                "input": "What is Go?",
                "reference": "Go is a programming language.",
            },
            {
                "input": "What is Go?",
                "reference": "C# is a programming language.",
            },
            {"input": "What is Julia?", "reference": "Julia is a programming language."},
            {"input": "What is Julia?", "reference": "unrelated"},
        ],
    )
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    mock_respx_responses(response_mapping)

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        data=alt_dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        include_prompt=True,
    )

    for original_row, processed_prompt in zip(dataframe.itertuples(), result["prompt"].to_list()):
        inp = original_row.input
        ref = original_row.reference
        assert (
            RAG_RELEVANCY_PROMPT_BASE_TEMPLATE.format(
                input=inp,
                reference=ref,
            )
            == processed_prompt
        )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_no_data_and_no_dataframe_args(
    classification_dataframe: DataFrame,
    openai_api_key: str,
):
    model = OpenAIModel()

    with pytest.raises(
        TypeError, match=r"llm_classify\(\) missing 1 required positional argument: 'data'"
    ):
        llm_classify(
            template=RAG_RELEVANCY_PROMPT_TEMPLATE,
            model=model,
            rails=["relevant", "unrelated"],
            verbose=True,
        )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_with_included_prompt_and_response(
    openai_api_key: str,
    classification_dataframe: DataFrame,
    respx_mock: respx.mock,
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
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

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
        include_prompt=True,
        include_response=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert result["label"].tolist() == expected_labels
    assert result["response"].tolist() == responses
    output_prompts = result["prompt"].tolist()
    inputs = dataframe["input"].tolist()
    references = dataframe["reference"].tolist()
    assert all(input in prompt for input, prompt in zip(inputs, output_prompts))
    assert all(reference in prompt for reference, prompt in zip(references, output_prompts))


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_with_async(
    openai_api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
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

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label"]],
        pd.DataFrame(
            data={"label": expected_labels},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_with_fn_call(
    openai_api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [{"message": {"function_call": {"arguments": {"response": response}}}}]
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(result[["label"]], pd.DataFrame(data={"label": expected_labels}))


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_classify_fn_call_no_explain(
    openai_api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {
            "choices": [{"message": {"function_call": {"arguments": {"response": response}}}}]
        }
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        provide_explanation=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label", "explanation"]],
        pd.DataFrame(data={"label": expected_labels, "explanation": [None, None, None, None]}),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_classify_fn_call_explain(
    openai_api_key: str, classification_dataframe: DataFrame, respx_mock: respx.mock
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
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

    model = OpenAIModel()

    result = llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        provide_explanation=True,
    )

    expected_labels = ["relevant", "unrelated", "relevant", NOT_PARSABLE]
    assert result.iloc[:, 0].tolist() == expected_labels
    assert_frame_equal(
        result[["label", "explanation"]],
        pd.DataFrame(data={"label": expected_labels, "explanation": ["0", "1", "2", "3"]}),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_llm_classify_prints_to_stdout_with_verbose_flag(
    classification_dataframe: DataFrame,
    openai_api_key: str,
    respx_mock: respx.mock,
    capfd: pytest.CaptureFixture[str],
):
    dataframe = classification_dataframe
    keys = list(zip(dataframe["input"], dataframe["reference"]))
    responses = ["relevant", "unrelated", "\nrelevant ", "unparsable"]
    response_mapping = {key: response for key, response in zip(keys, responses)}

    for (query, reference), response in response_mapping.items():
        matcher = M(content__contains=query) & M(content__contains=reference)
        payload = {"choices": [{"message": {"content": response}}]}
        respx_mock.route(matcher).mock(return_value=httpx.Response(200, json=payload))

    model = OpenAIModel()

    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "unrelated"],
        verbose=True,
        use_function_calling_if_available=False,
    )

    out, _ = capfd.readouterr()
    assert "Snapped 'relevant' to rail: relevant" in out, "Snapping events should be printed"
    assert "Snapped 'unrelated' to rail: unrelated" in out, "Snapping events should be printed"
    assert "Snapped '\\nrelevant ' to rail: relevant" in out, "Snapping events should be printed"
    assert "Cannot snap 'unparsable' to rails" in out, "Snapping events should be printed"
    assert "OpenAI invocation parameters" in out, "Model-specific information should be printed"
    assert "'model': 'gpt-4'" in out, "Model information should be printed"
    assert "'temperature': 0.0" in out, "Model information should be printed"
    assert "sk-0123456789" not in out, "Credentials should not be printed out in cleartext"


def test_llm_classify_shows_retry_info(openai_api_key: str, capfd: pytest.CaptureFixture[str]):
    dataframe = pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": "Python is a programming language.",
            },
        ]
    )

    with ExitStack() as stack:
        model = OpenAIModel()

        openai_retry_error = model._openai.APITimeoutError("test timeout")
        mock_openai = MagicMock()
        mock_openai.side_effect = openai_retry_error
        stack.enter_context(patch.object(model, "_generate", mock_openai))
        stack.enter_context(patch.object(model, "_async_generate", mock_openai))
        llm_classify(
            dataframe=dataframe,
            template=RAG_RELEVANCY_PROMPT_TEMPLATE,
            model=model,
            rails=["relevant", "unrelated"],
            max_retries=10,
        )

    out, _ = capfd.readouterr()
    assert "Exception in worker on attempt 1" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 2" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 3" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 4" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 5" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 6" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 7" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 8" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 9" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 10" in out, "Retry information should be printed"
    assert "Exception in worker on attempt 11" not in out, "Maximum retries should not be exceeded"
    assert "Retries exhausted after 11 attempts" in out, "Retry information should be printed"


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_classify_tolerance_to_exceptions(
    openai_api_key: str,
    classification_dataframe: pd.DataFrame,
    classification_responses: List[str],
    classification_template: str,
    respx_mock: respx.mock,
    capfd,
):
    model = OpenAIModel()
    queries = classification_dataframe["input"].tolist()
    for query, response in zip(queries, classification_responses):
        matcher = M(content__contains=query)
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    classification_df = llm_classify(
        dataframe=classification_dataframe,
        template=classification_template,
        model=model,
        rails=["relevant", "unrelated"],
    )

    assert classification_df is not None
    # Make sure there is a logger.error output
    captured = capfd.readouterr()
    assert "Exception in worker" in captured.out


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_classify_exits_on_missing_input(
    openai_api_key: str,
    classification_dataframe: pd.DataFrame,
    classification_responses: List[str],
    classification_template: str,
    respx_mock: respx.mock,
):
    model = OpenAIModel()
    queries = classification_dataframe["input"].tolist()
    for query, response in zip(queries, classification_responses):
        matcher = M(content__contains=query)
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    # remove an input to cause a template mapping exception
    classification_dataframe["input"][2] = None

    classification_df = llm_classify(
        dataframe=classification_dataframe,
        template=classification_template,
        model=model,
        rails=["relevant", "unrelated"],
        max_retries=4,
        exit_on_error=True,
        run_sync=True,  # run synchronously to ensure ordering
    )

    assert classification_df["execution_status"].tolist() == [
        ClassificationStatus.COMPLETED.value,
        ClassificationStatus.COMPLETED.value,
        ClassificationStatus.MISSING_INPUT.value,
        ClassificationStatus.DID_NOT_RUN.value,
    ]

    exceptions = classification_df["exceptions"].tolist()
    assert [len(excs) for excs in exceptions] == [
        0,
        0,
        1,  # one failure due to missing input
        0,  # never runs, so no exceptions
    ]


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_classify_skips_missing_input_with_when_exit_on_error_false(
    openai_api_key: str,
    classification_dataframe: pd.DataFrame,
    classification_responses: List[str],
    classification_template: str,
    respx_mock: respx.mock,
    capfd,
):
    model = OpenAIModel()
    queries = classification_dataframe["input"].tolist()
    for query, response in zip(queries, classification_responses):
        matcher = M(content__contains=query)
        if query == "What is C++?":
            response = httpx.Response(500, json={"error": "Internal Server Error"})
        else:
            response = httpx.Response(200, json={"choices": [{"message": {"content": response}}]})
        respx_mock.route(matcher).mock(return_value=response)

    # remove an input to cause a template mapping exception
    classification_dataframe["input"][2] = None

    classification_df = llm_classify(
        dataframe=classification_dataframe,
        template=classification_template,
        model=model,
        rails=["relevant", "unrelated"],
        max_retries=4,
        exit_on_error=False,
    )

    assert classification_df["execution_status"].tolist() == [
        ClassificationStatus.COMPLETED.value,
        ClassificationStatus.COMPLETED.value,
        ClassificationStatus.MISSING_INPUT.value,
        ClassificationStatus.FAILED.value,
    ]

    exceptions = classification_df["exceptions"].tolist()
    assert [len(excs) for excs in exceptions] == [
        0,
        0,
        1,  # one failure due to missing input
        5,  # first attempt + 4 retries
    ]
    execution_times = classification_df["execution_seconds"].tolist()
    assert len(execution_times) == 4
    assert all(isinstance(runtime, float) for runtime in execution_times)

    captured = capfd.readouterr()
    assert "Exception in worker" in captured.out


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_outputs_dataframes_with_labels_scores_and_explanations_with_function_calls(
    running_event_loop_mock: bool,
    respx_mock: respx.mock,
    toxicity_evaluator: LLMEvaluator,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, label, explanation in [
        (
            M(content__contains="Paris is the capital of France.")
            & M(content__contains="relevant"),
            "relevant",
            "relevant-explanation",
        ),
        (
            M(content__contains="Munich is the capital of Germany.")
            & M(content__contains="relevant"),
            "unrelated",
            "unrelated-explanation",
        ),
        (
            M(content__contains="What is the capital of France?") & M(content__contains="toxic"),
            "non-toxic",
            "non-toxic-explanation",
        ),
    ]:
        payload = {
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "function_call": {
                            "name": _FUNCTION_NAME,
                            "arguments": json.dumps({_RESPONSE: label, _EXPLANATION: explanation}),
                        },
                    },
                    "finish_reason": "function_call",
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
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator, toxicity_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=True,
    )
    assert len(eval_dfs) == 2
    assert_frame_equal(
        pd.DataFrame(
            {
                "label": ["relevant", "unrelated"],
                "score": [1, 0],
                "explanation": [
                    "relevant-explanation",
                    "unrelated-explanation",
                ],
            },
        ),
        eval_dfs[0],
    )
    assert_frame_equal(
        pd.DataFrame(
            {
                "label": ["non-toxic", "non-toxic"],
                "score": [0, 0],
                "explanation": [
                    "non-toxic-explanation",
                    "non-toxic-explanation",
                ],
            },
        ),
        eval_dfs[1],
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_outputs_dataframes_with_labels_scores_and_explanations(
    respx_mock: respx.mock,
    toxicity_evaluator: LLMEvaluator,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France.")
            & M(content__contains="relevant"),
            "relevant-explanation\nLABEL: relevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany.")
            & M(content__contains="relevant"),
            "unrelated-explanation\nLABEL: unrelated",
        ),
        (
            M(content__contains="What is the capital of France?") & M(content__contains="toxic"),
            "non-toxic-explanation\nLABEL: non-toxic",
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
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator, toxicity_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 2
    assert_frame_equal(
        eval_dfs[0],
        pd.DataFrame(
            {
                "label": ["relevant", "unrelated"],
                "score": [1, 0],
                "explanation": [
                    "relevant-explanation\nLABEL: relevant",
                    "unrelated-explanation\nLABEL: unrelated",
                ],
            },
        ),
    )
    assert_frame_equal(
        eval_dfs[1],
        pd.DataFrame(
            {
                "label": ["non-toxic", "non-toxic"],
                "score": [0, 0],
                "explanation": [
                    "non-toxic-explanation\nLABEL: non-toxic",
                    "non-toxic-explanation\nLABEL: non-toxic",
                ],
            },
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_outputs_dataframes_with_just_labels_and_scores_when_invoked_with_function_calls(
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
            "unrelated",
        ),
        (
            M(content__contains="What is the capital of France?") & M(content__contains="toxic"),
            "non-toxic",
        ),
    ]:
        payload = {
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "function_call": {
                            "name": _FUNCTION_NAME,
                            "arguments": json.dumps(
                                {
                                    _RESPONSE: response,
                                }
                            ),
                        },
                    },
                    "finish_reason": "function_call",
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
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator, toxicity_evaluator],
        provide_explanation=False,
        use_function_calling_if_available=True,
    )
    assert len(eval_dfs) == 2
    assert_frame_equal(
        eval_dfs[0],
        pd.DataFrame(
            {"label": ["relevant", "unrelated"], "score": [1, 0]},
        ),
    )
    assert_frame_equal(
        eval_dfs[1],
        pd.DataFrame(
            {"label": ["non-toxic", "non-toxic"], "score": [0, 0]},
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_outputs_dataframes_with_just_labels_and_scores(
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
            "unrelated",
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
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator, toxicity_evaluator],
        provide_explanation=False,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 2
    assert_frame_equal(
        eval_dfs[0],
        pd.DataFrame(
            {"label": ["relevant", "unrelated"], "score": [1, 0]},
        ),
    )
    assert_frame_equal(
        eval_dfs[1],
        pd.DataFrame(
            {"label": ["non-toxic", "non-toxic"], "score": [0, 0]},
        ),
    )


@pytest.mark.parametrize(
    "index",
    [
        pytest.param(
            pd.MultiIndex.from_arrays(
                [["span-id-0", "span-id-0"], [0, 1]], names=("content.span_id", "document_position")
            ),
            id="multiindex",
        ),
        pytest.param(
            pd.Index([0, 1], name="document_position"),
            id="index",
        ),
    ],
)
@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_preserves_index(
    index: pd.Index,
    respx_mock: respx.mock,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France."),
            "relevant-explanation\nLABEL: relevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany."),
            "unrelated-explanation\nLABEL: unrelated",
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
        index=index,
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 1
    assert_frame_equal(
        eval_dfs[0],
        pd.DataFrame(
            {
                "label": ["relevant", "unrelated"],
                "score": [1, 0],
                "explanation": [
                    "relevant-explanation\nLABEL: relevant",
                    "unrelated-explanation\nLABEL: unrelated",
                ],
            },
            index=index,
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_succeeds_regardless_of_whether_running_event_loop_exists(
    running_event_loop_mock: bool,
    respx_mock: respx.mock,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France."),
            "relevant-explanation\nLABEL: relevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany."),
            "unrelated-explanation\nLABEL: unrelated",
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
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 1
    assert_frame_equal(
        eval_dfs[0],
        pd.DataFrame(
            {
                "label": ["relevant", "unrelated"],
                "score": [1, 0],
                "explanation": [
                    "relevant-explanation\nLABEL: relevant",
                    "unrelated-explanation\nLABEL: unrelated",
                ],
            },
        ),
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions")
def test_run_evals_produces_expected_output_when_llm_outputs_unexpected_data(
    respx_mock: respx.mock,
    relevance_evaluator: LLMEvaluator,
) -> None:
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France."),
            "relevant-explanation\nrelevant",  # missing delimiter
        ),
        (
            M(content__contains="Munich is the capital of Germany."),
            "some-explanation\nLABEL: unparseable-label",  # unparseable-label
        ),
        (
            M(content__contains="Washington, D.C. is the capital of the USA."),
            "unrelated-explanation\nLABEL: unrelated",  # normal
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
            {
                "input": "What is the capital of France?",
                "reference": "Washington, D.C. is the capital of the USA.",
            },
        ],
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 1
    assert_frame_equal(
        pd.DataFrame(
            {
                "label": ["relevant", "NOT_PARSABLE", "unrelated"],
                "score": [1.0, 0.0, 0.0],
                "explanation": [
                    "relevant-explanation\nrelevant",
                    "some-explanation\nLABEL: unparseable-label",
                    "unrelated-explanation\nLABEL: unrelated",
                ],
            },
        ),
        eval_dfs[0],
    )


@pytest.mark.respx(base_url="https://api.openai.com/v1/chat/completions", assert_all_called=False)
def test_run_evals_fails_gracefully_on_error(
    respx_mock: respx.mock,
    relevance_evaluator: LLMEvaluator,
) -> None:
    # simulate an error
    for matcher, response in [
        (
            M(content__contains="Paris is the capital of France."),
            "relevant-explanation\nrelevant",
        ),
        (
            M(content__contains="Munich is the capital of Germany."),
            "some-explanation\nLABEL: unparseable-label",
        ),
        (
            M(content__contains="Washington, D.C. is the capital of the USA."),
            "unrelated-explanation\nLABEL: unrelated",
        ),
    ]:
        respx_mock.route(matcher).mock(side_effect=Exception("spurious test error"))

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
            {
                "input": "What is the capital of France?",
                "reference": "Washington, D.C. is the capital of the USA.",
            },
        ],
    )
    eval_dfs = run_evals(
        dataframe=df,
        evaluators=[relevance_evaluator],
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert len(eval_dfs) == 1
    assert_frame_equal(
        pd.DataFrame(
            {
                "label": [None, None, None],
                "score": [None, None, None],
                "explanation": [None, None, None],
            },
        ),
        eval_dfs[0],
    )


def test_run_evals_with_empty_evaluators_returns_empty_list() -> None:
    eval_dfs = run_evals(
        dataframe=pd.DataFrame(),
        evaluators=[],
    )
    assert eval_dfs == []


def test_classification_status_is_superset_of_execution_status() -> None:
    assert {item.value for item in ClassificationStatus}.issuperset(
        {item.value for item in ExecutionStatus}
    )
