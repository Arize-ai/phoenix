import math

import pytest

from phoenix.evals import RAG_RELEVANCY_PROMPT_TEMPLATE, ClassificationTemplate
from phoenix.evals.templates import (
    InvalidClassificationTemplateError,
    PromptOptions,
    PromptTemplate,
    parse_label_from_chain_of_thought_response
)

from phoenix.evals.utils import NOT_PARSABLE


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
def test_parse_label_from_chain_of_thought_response_extracts_first_word_when_matching_rail():
    """Test that the function extracts labels from the first word when it matches a rail."""
    rails = ["relevant", "unrelated", "correct", "incorrect"]
    
    # First word matches rail - this is the key new functionality
    assert parse_label_from_chain_of_thought_response(
        "incorrect EXPLANATION: The user input is wrong", rails
    ) == "incorrect"
    
    assert parse_label_from_chain_of_thought_response(
        "relevant EXPLANATION because it answers the question", rails
    ) == "relevant"


def test_parse_label_from_chain_of_thought_response_avoids_false_positives_from_explanations():
    """Test that the function doesn't extract labels from explanations (only first word)."""
    rails = ["relevant", "unrelated", "correct", "incorrect"]
    
    # Should NOT extract "relevant" from explanation text
    assert parse_label_from_chain_of_thought_response(
        "EXPLANATION: The text is relevant to the question", rails
    ) == NOT_PARSABLE
    
    # Should NOT extract "incorrect" from middle of explanation  
    assert parse_label_from_chain_of_thought_response(
        "The answer seems incorrect based on the context", rails
    ) == NOT_PARSABLE


def test_parse_label_from_chain_of_thought_response_handles_label_keyword_positioning():
    """Test that the function handles LABEL keyword in different positions and incomplete explanations."""
    rails = ["relevant", "unrelated", "correct", "incorrect"]
    
    # LABEL at beginning with incomplete explanation
    assert parse_label_from_chain_of_thought_response(
        "LABEL: incorrect EXPLANATION: The user is asking about the availability of", rails
    ) == "incorrect"
    
    # EXPLANATION first, then LABEL (should extract from LABEL section)
    assert parse_label_from_chain_of_thought_response(
        "EXPLANATION: The user is asking about the availability of\nLABEL: correct", rails
    ) == "correct"
    
    # LABEL with just the label word and no explanation
    assert parse_label_from_chain_of_thought_response(
        "LABEL: relevant", rails
    ) == "relevant"
    
    # Multiple LABEL keywords - should use first one
    assert parse_label_from_chain_of_thought_response(
        "LABEL: incorrect EXPLANATION: something LABEL: correct", rails
    ) == "incorrect"


def test_parse_label_from_chain_of_thought_response_handles_edge_cases():
    """Test edge cases to ensure complete coverage of all return paths."""
    rails = ["relevant", "irrelevant"]
    
    # Empty/whitespace input (return path 1)
    assert parse_label_from_chain_of_thought_response("", rails) == NOT_PARSABLE
    assert parse_label_from_chain_of_thought_response("   ", rails) == NOT_PARSABLE
    
    # LABEL keyword with first word matching rail when rail not found in label part (return path 3)
    assert parse_label_from_chain_of_thought_response(
        "LABEL: relevant but contains other text", ["relevant"]
    ) == "relevant"
    
    # LABEL keyword with no rails provided (return path 4)
    assert parse_label_from_chain_of_thought_response(
        "LABEL: someword explanation", None
    ) == "someword"
    
    # No rails provided, single word response (return path 6)
    assert parse_label_from_chain_of_thought_response("singleword", None) == "singleword"
