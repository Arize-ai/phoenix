import math
from unittest.mock import MagicMock

import pytest
from phoenix.evals import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    ClassificationTemplate,
    HallucinationEvaluator,
    LLMEvaluator,
    OpenAIModel,
    QAEvaluator,
    RelevanceEvaluator,
    SummarizationEvaluator,
    ToxicityEvaluator,
)
from phoenix.evals.utils import _EXPLANATION, _RESPONSE


@pytest.fixture
def relevance_template() -> ClassificationTemplate:
    return RAG_RELEVANCY_PROMPT_TEMPLATE


def test_llm_evaluator_evaluate_outputs_label_when_model_produces_expected_output(
    openai_model: OpenAIModel, relevance_template: ClassificationTemplate
) -> None:
    openai_model._generate = MagicMock(return_value="relevant ")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=False,
    )
    assert label == "relevant"
    assert math.isclose(score, 1.0)
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_not_parseable_when_model_produces_unexpected_output(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(return_value="not-in-the-rails")
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert math.isclose(score, 0.0)
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_label_and_explanation_when_model_produces_expected_output(
    openai_model: OpenAIModel, relevance_template: ClassificationTemplate
) -> None:
    output = "EXPLANATION: A very good explanation" 'LABEL: "relevant"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert label == "relevant"
    assert math.isclose(score, 1.0)
    assert "A very good explanation" in explanation


def test_llm_evaluator_evaluate_outputs_not_parseable_and_raw_response_when_output_is_not_in_rails(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    output = "EXPLANATION: A very good explanation" 'LABEL: "not-a-rail"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert math.isclose(score, 0.0)
    assert "EXPLANATION: A very good explanation" 'LABEL: "not-a-rail"' in explanation


def test_llm_evaluator_evaluate_outputs_not_parseable_and_raw_response_for_unparseable_model_output(
    openai_model: OpenAIModel, relevance_template: ClassificationTemplate
) -> None:
    output = 'Unexpected format: "rail"'
    openai_model._generate = MagicMock(return_value=output)
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
        use_function_calling_if_available=False,
    )
    assert label == NOT_PARSABLE
    assert math.isclose(score, 0.0)
    assert explanation == 'Unexpected format: "rail"'


def test_llm_evaluator_evaluate_outputs_label_when_called_with_function_call(
    openai_model: OpenAIModel, relevance_template: ClassificationTemplate
) -> None:
    openai_model._generate = MagicMock(return_value=f'{{"{_RESPONSE}": "relevant"}}')
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=True,
    )
    assert label == "relevant"
    assert math.isclose(score, 1.0)
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_label_and_explanation_when_called_with_function_call(
    openai_model: OpenAIModel, relevance_template: str
) -> None:
    openai_model._generate = MagicMock(
        return_value=f'{{"{_EXPLANATION}": "explanation", "{_RESPONSE}": "relevant"}}'
    )
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        provide_explanation=True,
    )
    assert label == "relevant"
    assert math.isclose(score, 1.0)
    assert explanation == "explanation"


def test_llm_evaluator_evaluate_makes_best_effort_attempt_to_parse_invalid_function_call_output(
    openai_model: OpenAIModel, relevance_template: ClassificationTemplate
) -> None:
    openai_model._generate = MagicMock(return_value=f'{{"{_RESPONSE}": "relevant"')  # invalid JSON
    evaluator = LLMEvaluator(openai_model, relevance_template)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=True,
    )
    assert label == "relevant"
    assert math.isclose(score, 1.0)
    assert explanation is None


@pytest.mark.parametrize(
    "evaluator_cls, expected_label",
    [
        pytest.param(
            HallucinationEvaluator,
            "hallucinated",
            id="hallucination-evaluator",
        ),
        pytest.param(
            RelevanceEvaluator,
            "relevant",
            id="relevance-evaluator",
        ),
        pytest.param(
            QAEvaluator,
            "correct",
            id="qa-evaluator",
        ),
        pytest.param(
            ToxicityEvaluator,
            "toxic",
            id="toxicity-evaluator",
        ),
        pytest.param(
            SummarizationEvaluator,
            "good",
            id="summarization-evaluator",
        ),
    ],
)
def test_evaluator_evaluate_outputs_expected_label_when_model_produces_expected_output(
    evaluator_cls: LLMEvaluator,
    expected_label: str,
    openai_model: OpenAIModel,
) -> None:
    openai_model._generate = MagicMock(return_value=expected_label)
    evaluator = evaluator_cls(openai_model)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "input-text",
            "reference": "reference-text",
            "output": "output-text",
        },
        use_function_calling_if_available=False,
    )
    assert label == expected_label
    assert math.isclose(score, 1.0)
    assert explanation is None


def test_llm_evaluator_evaluate_outputs_score_as_zero_with_custom_template_without_scores(
    openai_model: OpenAIModel,
) -> None:
    custom_template_without_scores = ClassificationTemplate(
        rails=["relevant", "irrelevant"],
        template="Is the {reference} relevant to the {input}?",
        explanation_template="Is the {reference} relevant to the {input}? Explain.",
    )
    openai_model._generate = MagicMock(return_value="relevant ")
    evaluator = LLMEvaluator(openai_model, custom_template_without_scores)
    label, score, explanation = evaluator.evaluate(
        {
            "input": "What is the capital of California?",
            "reference": "Sacramento is the capital of California.",
        },
        use_function_calling_if_available=False,
    )
    assert label == "relevant"
    assert math.isclose(score, 0.0)
    assert explanation is None
