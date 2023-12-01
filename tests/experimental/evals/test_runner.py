import pandas as pd
import phoenix
import pytest
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals.evaluators import LLMEvaluator
from phoenix.experimental.evals.functions.classify import run_evals
from phoenix.experimental.evals.models import OpenAIModel
from phoenix.experimental.evals.templates.default_templates import (
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_TEMPLATE,
)


@pytest.fixture
def model() -> OpenAIModel:
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
def running_event_loop_mock(monkeypatch):
    monkeypatch.setattr(
        "phoenix.experimental.evals.functions.classify._running_event_loop_exists",
        lambda: True,
    )
    assert (
        phoenix.experimental.evals.functions.classify._running_event_loop_exists()
    ), "mock for detecting event loop should return True"


def test_run_evals_produces_expected_output_dataframe_when_no_running_event_loop_exists(
    toxicity_evaluator: LLMEvaluator, relevance_evaluator: LLMEvaluator
) -> None:
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


def test_run_evals_produces_expected_output_dataframe_when_running_event_loop_already_exists(
    running_event_loop_mock, toxicity_evaluator: LLMEvaluator, relevance_evaluator: LLMEvaluator
) -> None:
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
    toxicity_evaluator: LLMEvaluator
) -> None:
    with pytest.raises(ValueError):
        run_evals(
            dataframe=pd.DataFrame(),
            evaluators=[toxicity_evaluator, toxicity_evaluator],
        )
