import pytest
from pydantic import TypeAdapter, ValidationError

from phoenix.db.types.decisions import (
    DecisionQuestion,
    DecisionState,
)
from phoenix.server.decisions.validation import validate_questions

_QUESTIONS_ADAPTER: TypeAdapter[list[DecisionQuestion]] = TypeAdapter(list[DecisionQuestion])
_STATE_ADAPTER: TypeAdapter[DecisionState] = TypeAdapter(DecisionState)

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
    questions = _QUESTIONS_ADAPTER.validate_python([stored])
    assert [question.model_dump() for question in questions] == [stored]
    with pytest.raises(ValueError, match=message):
        validate_questions(questions)


def test_stored_questions_reject_an_unknown_type() -> None:
    with pytest.raises(ValidationError):
        _QUESTIONS_ADAPTER.validate_python(
            [{"type": "box", "name": "mug", "instructions": "Where is the mug?"}]
        )


def test_stored_state_round_trips() -> None:
    for state in (
        {"type": "text", "template": "{{ticket}}"},
        {"type": "json", "template": {"ticket": "{{ticket}}", "n": 1, "tags": ["a", None]}},
        {"type": "json", "template": "{{state}}"},
    ):
        assert _STATE_ADAPTER.validate_python(state).model_dump() == state
    for retired in (
        {"type": "object"},
        {"type": "input", "name": "state"},
        {"type": "text", "template": "{{ticket}}", "template_format": "MUSTACHE"},
        {"type": "messages", "messages": []},
    ):
        with pytest.raises(ValidationError):
            _STATE_ADAPTER.validate_python(retired)
