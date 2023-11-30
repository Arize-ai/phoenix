import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals.evaluators import LLMEvaluator
from phoenix.experimental.evals.models import OpenAIModel
from phoenix.experimental.evals.runner import run_evals
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


def test_run_evals_produces_expected_output_dataframe(
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


def test_run_evals_with_evaluators_with_duplicate_names_raises_value_error(
    toxicity_evaluator: LLMEvaluator
) -> None:
    with pytest.raises(ValueError):
        run_evals(
            dataframe=pd.DataFrame(),
            evaluators=[toxicity_evaluator, toxicity_evaluator],
        )
