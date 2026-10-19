import pytest
from pydantic import ValidationError

from phoenix.db.types.decisions import (
    DecisionInputsRootModel,
    DecisionQuestionsRootModel,
    DecisionStateRootModel,
)
from phoenix.server.api.helpers.decision_versions import validate_questions

_STORED_QUESTIONS = {
    "one-choice": (
        {"type": "choice", "name": "team", "instructions": "Which?", "choices": [{"value": "a"}]},
        "team needs 2 to 255 choices",
    ),
    "eleven-levels": (
        {
            "type": "scale",
            "name": "severity",
            "instructions": "How bad?",
            "levels": [{"label": str(level)} for level in range(11)],
        },
        "severity needs 2 to 10 levels",
    ),
}


@pytest.mark.parametrize("case", list(_STORED_QUESTIONS))
def test_stored_questions_read_back_even_when_write_rules_reject_them(case: str) -> None:
    """The stored types check structure only. A row that breaks today's write-time rules
    (one choice, or eleven levels) still reads back, so tightening a rule never makes old
    versions unreadable; accepting the same questions for a run or save fails."""
    stored, message = _STORED_QUESTIONS[case]
    questions = DecisionQuestionsRootModel.model_validate([stored]).root
    assert [question.model_dump() for question in questions] == [stored]
    with pytest.raises(ValueError, match=message):
        validate_questions(questions)


def test_stored_questions_reject_an_unknown_type() -> None:
    with pytest.raises(ValidationError):
        DecisionQuestionsRootModel.model_validate(
            [{"type": "box", "name": "mug", "instructions": "Where is the mug?"}]
        )


def test_stored_inputs_and_state_round_trip() -> None:
    inputs = [
        {"name": "ticket", "description": "The message", "json_schema": {"type": "string"}},
        {"name": "plan"},
    ]
    assert [
        item.model_dump() for item in DecisionInputsRootModel.model_validate(inputs).root
    ] == inputs
    for state in (
        {"type": "object"},
        {"type": "text", "template": "{{ticket}}", "template_format": "MUSTACHE"},
    ):
        assert DecisionStateRootModel.model_validate(state).root.model_dump() == state
    with pytest.raises(ValidationError):
        DecisionStateRootModel.model_validate({"type": "messages", "messages": []})
