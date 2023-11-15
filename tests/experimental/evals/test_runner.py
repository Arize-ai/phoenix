import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals.evaluators import LLMEvaluator
from phoenix.experimental.evals.models import OpenAIModel
from phoenix.experimental.evals.runner import EvalRunner
from phoenix.experimental.evals.templates.default_templates import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    TOXICITY_PROMPT_RAILS_MAP,
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
        rails=list(TOXICITY_PROMPT_RAILS_MAP.values()),
        verbose=True,
    )


@pytest.fixture
def relevance_evaluator(model: OpenAIModel) -> LLMEvaluator:
    return LLMEvaluator(
        name="relevance",
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
        verbose=True,
    )


def test_eval_runner_with_evaluator_arguments_produces_expected_output_dataframe(
    model: OpenAIModel, toxicity_evaluator: LLMEvaluator, relevance_evaluator: LLMEvaluator
) -> None:
    runner = EvalRunner(evaluators=[relevance_evaluator, toxicity_evaluator])
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
    eval_df = runner.evaluate_dataframe(df)
    assert_frame_equal(
        eval_df,
        pd.DataFrame(
            {"relevance": ["relevant", "irrelevant"], "toxicity": ["non-toxic", "non-toxic"]},
            index=["a", "b"],
        ),
    )


def test_eval_runner_with_mixed_evaluator_arguments_produces_expected_output_dataframe(
    model: OpenAIModel, toxicity_evaluator: LLMEvaluator
) -> None:
    runner = EvalRunner(evaluators=["relevance", toxicity_evaluator], model=model)
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
    eval_df = runner.evaluate_dataframe(df)
    assert_frame_equal(
        eval_df,
        pd.DataFrame(
            {"relevance": ["relevant", "irrelevant"], "toxicity": ["non-toxic", "non-toxic"]},
            index=["a", "b"],
        ),
    )


def test_eval_runner_raises_value_error_when_initialized_with_model_and_evaluators(
    model: OpenAIModel, toxicity_evaluator: LLMEvaluator, relevance_evaluator: LLMEvaluator
) -> None:
    with pytest.raises(ValueError):
        EvalRunner(evaluators=[relevance_evaluator, toxicity_evaluator], model=model)


def test_eval_runner_raises_value_error_when_initialized_with_an_evaluator_name_but_no_model(
    toxicity_evaluator: LLMEvaluator
) -> None:
    with pytest.raises(ValueError):
        EvalRunner(evaluators=["relevance", toxicity_evaluator])
