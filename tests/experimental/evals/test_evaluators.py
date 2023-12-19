from unittest.mock import MagicMock

import pytest
from phoenix.experimental.evals import LLMEvaluator, OpenAIModel
from phoenix.experimental.evals.templates import NOT_PARSABLE, RAG_RELEVANCY_PROMPT_TEMPLATE


@pytest.fixture
def relevance_template() -> str:
    return RAG_RELEVANCY_PROMPT_TEMPLATE


def test_evaluator_evaluate_outputs_label_when_model_produces_expected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value="relevant ")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
    )
    assert label == "relevant"
    assert explanation is None


def test_evaluator_evaluate_outputs_not_parseable_when_model_produces_unexpected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value="not-in-the-rails")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
    )
    assert label == NOT_PARSABLE
    assert explanation is None


def test_evaluator_evaluate_outputs_label_and_explanation_when_model_produces_expected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    output = "EXPLANATION: A very good explanation" 'LABEL: "relevant"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
    )
    assert label == "relevant"
    assert "A very good explanation" in explanation


def test_evaluator_evaluate_outputs_not_parseable_and_raw_response_when_output_is_not_in_rails(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    output = "EXPLANATION: A very good explanation" 'LABEL: "not-a-rail"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
    )
    assert label == NOT_PARSABLE
    assert "EXPLANATION: A very good explanation" 'LABEL: "not-a-rail"' in explanation


def test_evaluator_evaluate_outputs_not_parseable_and_raw_response_for_unparseable_model_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    output = 'Unexpected format: "rail"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
    )
    assert label == NOT_PARSABLE
    assert explanation == 'Unexpected format: "rail"'
