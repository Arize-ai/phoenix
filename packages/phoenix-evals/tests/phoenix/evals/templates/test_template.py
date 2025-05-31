import math

import pytest

from phoenix.evals import RAG_RELEVANCY_PROMPT_TEMPLATE, ClassificationTemplate
from phoenix.evals.templates import (
    InvalidClassificationTemplateError,
    PromptOptions,
    PromptTemplate,
    parse_label_from_chain_of_thought_response,
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


def test_parse_label_from_chain_of_thought_response_extracts_first_word_when_matching_rail():
    """Test that the function extracts labels from the first word when it matches a rail."""
    rails = ["relevant", "unrelated", "correct", "incorrect"]

    # First word matches rail - this is the key new functionality
    assert (
        parse_label_from_chain_of_thought_response(
            "incorrect EXPLANATION: The user input is wrong", rails=rails
        )
        == "incorrect"
    )

    assert (
        parse_label_from_chain_of_thought_response(
            "relevant EXPLANATION because it answers the question", rails=rails
        )
        == "relevant"
    )

    # Test case-insensitive matching with rail casing preservation
    # Input has lowercase, rail has capitalized - should return rail's casing
    assert (
        parse_label_from_chain_of_thought_response(
            "correct EXPLANATION: This demonstrates case preservation", rails=["Correct"]
        )
        == "Correct"
    )

    # Input has uppercase, rail has lowercase - should return rail's casing
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: Correct", rails=["correct"]
        )
        == "correct"
    )

    # Mixed case input with mixed case rail
    assert (
        parse_label_from_chain_of_thought_response(
            "INCORRECT explanation text", rails=["Incorrect"]
        )
        == "Incorrect"
    )

    # All caps input with Title case rail
    assert (
        parse_label_from_chain_of_thought_response(
            "RELEVANT to the discussion", rails=["Relevant", "Irrelevant"]
        )
        == "Relevant"
    )

    # Lowercase input with UPPERCASE rail
    assert (
        parse_label_from_chain_of_thought_response(
            "unrelated content here", rails=["UNRELATED", "RELATED"]
        )
        == "UNRELATED"
    )


def test_parse_label_from_chain_of_thought_response_avoids_false_positives_from_explanations():
    """Test that the function doesn't extract labels from explanations (only first word)."""
    rails = ["relevant", "unrelated", "correct", "incorrect"]

    # Should NOT extract "relevant" from explanation text
    assert (
        parse_label_from_chain_of_thought_response(
            "EXPLANATION: The text is relevant to the question", rails=rails
        )
        == "EXPLANATION: The text is relevant to the question"
    )

    # Should NOT extract "incorrect" from middle of explanation
    assert (
        parse_label_from_chain_of_thought_response(
            "The answer seems incorrect based on the context", rails=rails
        )
        == "The answer seems incorrect based on the context"
    )


def test_parse_label_from_chain_of_thought_response_handles_label_keyword_positioning():
    """Test that the function handles LABEL keyword in different positions and
    incomplete explanations."""
    rails = ["correct", "incorrect"]

    # LABEL at beginning with incomplete explanation
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: incorrect EXPLANATION: The user is asking about the availability of", rails=rails
        )
        == "incorrect"
    )

    # EXPLANATION first, then LABEL (should extract from LABEL section)
    assert (
        parse_label_from_chain_of_thought_response(
            "EXPLANATION: The user is asking about the availability of\nLABEL: correct", rails=rails
        )
        == "correct"
    )

    # LABEL with just the label word and no explanation
    assert parse_label_from_chain_of_thought_response("LABEL: correct", rails=rails) == "correct"

    # Multiple LABEL keywords - should use first one
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: incorrect EXPLANATION: something LABEL: correct", rails=rails
        )
        == "incorrect"
    )


def test_parse_label_from_chain_of_thought_response_handles_edge_cases():
    """Test edge cases to ensure complete coverage of all return paths."""
    rails = ["relevant", "irrelevant"]

    # Empty/whitespace input (return path 1)
    assert parse_label_from_chain_of_thought_response("", rails=rails) == ""
    assert parse_label_from_chain_of_thought_response("   ", rails=rails) == "   "

    # Test when the first word after 'LABEL:' matches a rail.
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: relevant but contains other text", rails=["relevant"]
        )
        == "relevant"
    )

    # LABEL keyword with no rails provided (return path 4)
    assert (
        parse_label_from_chain_of_thought_response("LABEL: someword explanation", rails=None)
        == "someword"
    )

    # No rails provided, single word response (return path 6)
    assert parse_label_from_chain_of_thought_response("singleword", rails=None) == "singleword"

    # Test labels with trailing punctuation
    rails_punctuation = ["incorrect", "correct"]
    
    # With LABEL keyword and trailing period
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: incorrect.", rails=rails_punctuation
        )
        == "incorrect."  # Returns with punctuation since no exact match found
    )
    
    # With LABEL keyword and trailing exclamation
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: correct!", rails=rails_punctuation
        )
        == "correct!"  # Returns with punctuation since no exact match found
    )
    
    # First word with trailing punctuation
    assert (
        parse_label_from_chain_of_thought_response(
            "incorrect! EXPLANATION: Strong disagreement", rails=rails_punctuation
        )
        == "incorrect! EXPLANATION: Strong disagreement"  # No match, returns full string
    )
    
    # First word with trailing comma
    assert (
        parse_label_from_chain_of_thought_response(
            "correct, but needs clarification", rails=rails_punctuation
        )
        == "correct, but needs clarification"  # No match, returns full string
    )
    
    # With LABEL keyword and multiple punctuation marks
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: incorrect...", rails=rails_punctuation
        )
        == "incorrect..."  # Returns with punctuation since no exact match found
    )
    
    # Test that exact matches still work (no punctuation)
    assert (
        parse_label_from_chain_of_thought_response(
            "incorrect EXPLANATION: No punctuation", rails=rails_punctuation
        )
        == "incorrect"
    )


def test_parse_label_from_chain_of_thought_response_handles_quoted_labels():
    """Test that the function correctly handles labels wrapped in quotes."""
    rails = ["correct", "incorrect"]

    # Label with double quotes
    assert (
        parse_label_from_chain_of_thought_response(
            'Label: "correct" - Explanation follows', rails=rails
        )
        == "correct"
    )

    # Label with single quotes  
    assert (
        parse_label_from_chain_of_thought_response(
            "Label: 'incorrect' - Some explanation", rails=rails
        )
        == "incorrect"
    )

    # Label with quotes but no LABEL keyword (first word)
    assert (
        parse_label_from_chain_of_thought_response(
            '"correct" is the answer based on analysis', rails=rails
        )
        == "correct"
    )

    # Mixed quotes
    assert (
        parse_label_from_chain_of_thought_response(
            "LABEL: \"correct' - Mixed quotes test", rails=rails
        )
        == "correct"
    )

    # Multiple words in quotes (should only extract first)
    assert (
        parse_label_from_chain_of_thought_response(
            'Label: "correct answer" - The full response', rails=rails
        )
        == "correct"
    )
