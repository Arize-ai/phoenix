import pytest
from pydantic import ValidationError

from phoenix.db.types.decisions import (
    DecisionInputsRootModel,
    DecisionQuestionsRootModel,
    DecisionStateRootModel,
)
from phoenix.server.api.helpers.decision_versions import validate_questions


def test_stored_questions_read_back_even_when_write_rules_reject_them() -> None:
    """The stored types check structure only. A row that breaks today's write-time rules
    (here, one choice and eleven levels) still reads back, so tightening a rule never
    makes old versions unreadable; accepting the same questions for a run or save fails."""
    stored = [
        {"type": "choice", "name": "team", "instructions": "Which?", "choices": [{"value": "a"}]},
        {
            "type": "scale",
            "name": "severity",
            "instructions": "How bad?",
            "levels": [{"label": str(level)} for level in range(11)],
        },
    ]
    questions = DecisionQuestionsRootModel.model_validate(stored).root
    assert [question.model_dump() for question in questions] == stored
    with pytest.raises(ValueError, match="team needs 2 to 255 choices"):
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
