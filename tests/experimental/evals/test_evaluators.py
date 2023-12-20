from unittest.mock import MagicMock

import pytest
from phoenix.experimental.evals import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    EvalCriteria,
    LLMEvaluator,
    OpenAIModel,
)
from phoenix.experimental.evals.utils import _EXPLANATION, _RESPONSE


@pytest.fixture
def relevance_template() -> str:
    return RAG_RELEVANCY_PROMPT_TEMPLATE


def test_llm_evaluator_evaluate_outputs_label_when_model_produces_expected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value="relevant ")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=False,
    )
    assert label == "relevant"
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_not_parseable_when_model_produces_unexpected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value="not-in-the-rails")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_label_and_explanation_when_model_produces_expected_output(
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
        use_function_calling_if_available=False,
    )
    assert label == "relevant"
    assert "A very good explanation" in explanation


def test_llm_evaluator_evaluate_outputs_not_parseable_and_raw_response_when_output_is_not_in_rails(
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
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert "EXPLANATION: A very good explanation" 'LABEL: "not-a-rail"' in explanation


def test_llm_evaluator_evaluate_outputs_not_parseable_and_raw_response_for_unparseable_model_output(
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
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert explanation == 'Unexpected format: "rail"'


def test_llm_evaluator_evaluate_outputs_label_when_called_with_function_call(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value=f'{{"{_RESPONSE}": "relevant"}}')
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=True,
    )
    assert label == "relevant"
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_label_and_explanation_when_called_with_function_call(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(
        return_value=f'{{"{_EXPLANATION}": "explanation", "{_RESPONSE}": "relevant"}}'
    )
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
    )
    assert label == "relevant"
    assert explanation == "explanation"


def test_llm_evaluator_evaluate_makes_best_effort_attempt_to_parse_invalid_function_call_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value=f'{{"{_RESPONSE}": "relevant"')  # invalid JSON
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=True,
    )
    assert label == "relevant"
    assert explanation is None


def test_llm_evaluator_from_criteria_instantiates_instance(
    openai_model: OpenAIModel,
) -> None:
    evaluator = LLMEvaluator.from_criteria(criteria=EvalCriteria.RELEVANCE, model=openai_model)
    assert isinstance(evaluator, LLMEvaluator)
