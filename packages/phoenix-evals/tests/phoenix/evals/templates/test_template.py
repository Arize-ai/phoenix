import math

import pytest

from phoenix.evals import RAG_RELEVANCY_PROMPT_TEMPLATE, ClassificationTemplate
from phoenix.evals.templates import InvalidClassificationTemplateError, PromptTemplate


def test_classification_template_raises_error_when_initialized_with_mismatched_labels_and_scores():
    with pytest.raises(InvalidClassificationTemplateError):
        ClassificationTemplate(
            rails=["relevant", "irrelevant"],
            template="template",
            scores=[0],
        )


def test_classification_template_score_returns_correct_score_for_present_rail():
    score = RAG_RELEVANCY_PROMPT_TEMPLATE.score("relevant")
    assert score == 1


def test_classification_template_score_returns_zero_for_missing_rail():
    score = RAG_RELEVANCY_PROMPT_TEMPLATE.score("missing")
    assert math.isclose(score, 0.0)


def test_template_with_default_delimiters_uses_python_string_formatting():
    template = PromptTemplate(template='Hello, {name}! Look at this JSON {{ "hello": "world" }}')
    assert (
        template.format(variable_values={"name": "world"})
        == 'Hello, world! Look at this JSON { "hello": "world" }'
    )
