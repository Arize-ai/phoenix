import math

import pytest

from phoenix.evals import RAG_RELEVANCY_PROMPT_TEMPLATE, ClassificationTemplate
from phoenix.evals.templates import (
    InvalidClassificationTemplateError,
    PromptOptions,
    PromptTemplate,
)


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


def test_classification_template_can_beinstantiated_with_no_explanation_template():
    template = ClassificationTemplate(
        rails=["relevant", "irrelevant"], template="is this irrelevant?"
    )
    assert template.explanation_template is None

    explanation_options = PromptOptions(provide_explanation=True)
    assert template.prompt(options=explanation_options)[0].template == "is this irrelevant?"


def test_template_with_default_delimiters_uses_python_string_formatting():
    template = PromptTemplate(template='Hello, {name}! Look at this JSON {{ "hello": "world" }}')
    assert (
        str(template.format(variable_values={"name": "world"}))
        == 'Hello, world! Look at this JSON { "hello": "world" }'
    )


def test_template_with_default_delimiters_accepts_keys_with_dots():
    template = PromptTemplate(template='Hello, {my.name}! Look at this JSON {{ "hello": "world" }}')
    assert (
        str(template.format(variable_values={"my.name": "world"}))
        == 'Hello, world! Look at this JSON { "hello": "world" }'
    )


def test_template_with_alternate_delimiters():
    template = PromptTemplate(
        template='Hello, ~name~! Look at this JSON {"hello": "world"}',
        delimiters=("~", "~"),
    )
    assert (
        str(template.format(variable_values={"name": "world"}))
        == 'Hello, world! Look at this JSON {"hello": "world"}'
    )
