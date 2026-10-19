from typing import Any

import pytest

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionQuestion,
    PredicateCriteria,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
)
from phoenix.server.api.helpers.decision_clients import (
    DecisionConnection,
    DecisionRequest,
    OpenAIDecisionClient,
    TypeSafeDecisionClient,
)
from phoenix.server.api.helpers.decision_formats import parse_questions

CONNECTION = DecisionConnection(api_key="test", base_url="https://example.invalid")

QUESTIONS: list[DecisionQuestion] = [
    ChoiceQuestion(
        type="choice",
        name="department",
        instructions="Which team?",
        choices=[
            ChoiceOption(value="billing", description="Payments"),
            ChoiceOption(value="technical"),
        ],
    ),
    PredicateQuestion(type="predicate", name="urgent", instructions="Is this urgent?"),
    ScaleQuestion(
        type="scale",
        name="severity",
        instructions="How severe?",
        levels=[ScaleLevel(label="low"), ScaleLevel(label="high")],
    ),
]


def test_system_one_round_trips_through_the_typesafe_adapter() -> None:
    """Reading what the adapter writes gives back the questions it was given."""
    request = DecisionRequest(state="hello", questions=QUESTIONS)
    body = TypeSafeDecisionClient(model_name="jev-latest", connection=CONNECTION)._build_request(
        request
    )
    assert parse_questions(body["questions"], "system_one") == QUESTIONS


def test_openai_round_trips_through_the_openai_adapter() -> None:
    request = DecisionRequest(state="hello", questions=QUESTIONS)
    body = OpenAIDecisionClient(model_name="gpt-6-luna", connection=CONNECTION)._build_request(
        request
    )
    assert parse_questions(body["questions"], "openai") == QUESTIONS


def test_phoenix_questions_are_read_as_stored() -> None:
    stored = [question.model_dump(exclude_none=True) for question in QUESTIONS]
    assert parse_questions(stored, "phoenix") == QUESTIONS


def test_system_one_rows_as_published() -> None:
    """Shaped like the JevBench and Typed Decisions rows datagen seeds."""
    questions = parse_questions(
        {
            "needs_review": {
                "type": "noul",
                "instructions": "This trace requires human review.",
                "criteria": {"true": "A human should inspect this run.", "false": "No."},
            },
            "risk": {
                "type": "score",
                "instructions": "Rate the risk.",
                "criteria": ["Low", "High"],
            },
        },
        "system_one",
    )
    assert questions == [
        PredicateQuestion(
            type="predicate",
            name="needs_review",
            instructions="This trace requires human review.",
            criteria=PredicateCriteria(true="A human should inspect this run.", false="No."),
        ),
        ScaleQuestion(
            type="scale",
            name="risk",
            instructions="Rate the risk.",
            levels=[ScaleLevel(label="Low"), ScaleLevel(label="High")],
        ),
    ]


def test_structured_system_one_text_becomes_json_text() -> None:
    """Phoenix question text is plain text, so a structured description is kept as JSON."""
    (question,) = parse_questions(
        {
            "tone": {
                "type": "choice",
                "instructions": {"ask": "Which tone?"},
                "criteria": {"calm": None, "angry": ["raised", "voice"]},
            }
        },
        "system_one",
    )
    assert question == ChoiceQuestion(
        type="choice",
        name="tone",
        instructions='{"ask": "Which tone?"}',
        choices=[
            ChoiceOption(value="calm"),
            ChoiceOption(value="angry", description='["raised", "voice"]'),
        ],
    )


@pytest.mark.parametrize(
    ("value", "question_format", "message"),
    [
        pytest.param([], "system_one", "keyed by question name", id="system-one-list"),
        pytest.param({"q": {"type": "box"}}, "system_one", "unsupported type", id="box"),
        pytest.param(
            {"q": {"type": "choice", "criteria": ["a", "b"]}},
            "system_one",
            "object of choices",
            id="choice-list",
        ),
        pytest.param({"q": "text"}, "system_one", "must be an object", id="not-an-object"),
        pytest.param({}, "openai", "must be a list", id="openai-object"),
        pytest.param([{"type": "predicate"}], "openai", "needs a name", id="openai-no-name"),
        pytest.param(
            [{"name": "q", "type": "choice", "choices": ["a"]}],
            "openai",
            "must be objects",
            id="openai-bare-choice",
        ),
        pytest.param([{"type": "noul"}], "phoenix", "Not Phoenix questions", id="phoenix"),
    ],
)
def test_malformed_questions_are_rejected(value: Any, question_format: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        parse_questions(value, question_format)
