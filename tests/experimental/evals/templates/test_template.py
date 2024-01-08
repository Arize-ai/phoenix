import math

import pytest
from phoenix.experimental.evals import RAG_RELEVANCY_PROMPT_TEMPLATE, ClassificationTemplate
from phoenix.experimental.evals.templates.template import InvalidClassificationTemplateError


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
