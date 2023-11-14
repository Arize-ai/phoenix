import pandas as pd
from pandas.testing import assert_frame_equal
from phoenix.experimental.evals.evaluators import LLMClassifier
from phoenix.experimental.evals.models import OpenAIModel
from phoenix.experimental.evals.runner import EvalRunner
from phoenix.experimental.evals.templates import PromptTemplate
from phoenix.experimental.evals.templates.default_templates import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    TOXICITY_PROMPT_RAILS_MAP,
    TOXICITY_PROMPT_TEMPLATE_STR,
)


def test_eval_runner_with_evaluator_arguments_produces_expected_output_dataframe() -> None:
    model = OpenAIModel(model_name="gpt-4")
    relevance_evaluator = LLMClassifier(
        name="relevance",
        template=PromptTemplate(RAG_RELEVANCY_PROMPT_TEMPLATE_STR),
        model=model,
        rails=list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
        verbose=True,
    )
    toxicity_evaluator = LLMClassifier(
        name="toxicity",
        template=PromptTemplate(TOXICITY_PROMPT_TEMPLATE_STR),
        model=model,
        rails=list(TOXICITY_PROMPT_RAILS_MAP.values()),
        verbose=True,
    )
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


def test_eval_runner_with_mixed_evaluator_arguments_produces_expected_output_dataframe() -> None:
    model = OpenAIModel(model_name="gpt-4")
    toxicity_evaluator = LLMClassifier(
        name="toxicity",
        template=PromptTemplate(TOXICITY_PROMPT_TEMPLATE_STR),
        model=model,
        rails=list(TOXICITY_PROMPT_RAILS_MAP.values()),
        verbose=True,
    )
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
