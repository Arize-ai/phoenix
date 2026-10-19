from typing import Any

import pytest

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionInput,
    DecisionQuestion,
    DecisionState,
    InputState,
    ObjectState,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
    TextState,
)
from phoenix.server.api.helpers.decision_versions import (
    render_state,
    validate_inputs,
    validate_questions,
)


def _inputs(*names: str) -> list[DecisionInput]:
    return [DecisionInput(name=name) for name in names]


def _text(template: str, template_format: Any = "MUSTACHE") -> TextState:
    return TextState(type="text", template=template, template_format=template_format)


OBJECT = ObjectState(type="object")


def test_object_state_is_exactly_the_declared_inputs() -> None:
    values = {"ticket": {"body": "Refund?", "tags": ["billing"]}, "plan": None}
    assert render_state(_inputs("ticket", "plan"), OBJECT, values) == values


@pytest.mark.parametrize(
    "values,message",
    [
        ({"ticket": "x"}, "Missing inputs: plan"),
        ({"ticket": "x", "plan": "pro", "extra": 1}, "Undeclared inputs: extra"),
        ({"ticket": "x", "plna": "pro"}, "Missing inputs: plan; Undeclared inputs: plna"),
    ],
)
def test_input_values_must_match_the_declared_inputs(values: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        render_state(_inputs("ticket", "plan"), OBJECT, values)


def test_mustache_renders_structured_inputs_as_json_and_still_reads_into_them() -> None:
    template = (
        "{{ticket}} | {{ticket.body}} | {{#tags}}<{{.}}>{{/tags}} | "
        "{{flag}} {{^flag}}off{{/flag}} | {{missing}}{{^missing}}none{{/missing}}"
    )
    rendered = render_state(
        _inputs("ticket", "tags", "flag", "missing"),
        _text(template),
        {
            "ticket": {"body": "Refund?", "vip": True},
            "tags": ["a", "b"],
            "flag": False,
            "missing": None,
        },
    )
    assert rendered == '{"body": "Refund?", "vip": true} | Refund? | <a><b> | false off | nullnone'


def test_f_string_renders_structured_inputs_as_json() -> None:
    rendered = render_state(
        _inputs("ticket", "count"),
        _text("Ticket: {ticket} ({count})", "F_STRING"),
        {"ticket": {"body": "Refund?"}, "count": 2},
    )
    assert rendered == 'Ticket: {"body": "Refund?"} (2)'


@pytest.mark.parametrize(
    "inputs,state,message",
    [
        ([], OBJECT, "At least one input is required"),
        (_inputs(" "), OBJECT, "Input names cannot be empty"),
        (_inputs("a", "a"), OBJECT, "Input names must be unique: 'a' is repeated"),
        (_inputs("a"), _text("  "), "The state template cannot be empty"),
        (_inputs("a"), _text("{{a}} {{b}} {{c.d}}"), "uses undeclared inputs: b, c"),
        (_inputs("a"), _text("{{#a}}"), "The state template is invalid"),
        (_inputs("a"), InputState(type="input", name="b"), "uses an undeclared input: b"),
    ],
)
def test_invalid_inputs_and_state_are_rejected(
    inputs: list[DecisionInput], state: DecisionState, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_inputs(inputs, state)


def test_input_state_is_one_value_unchanged() -> None:
    """Not wrapped in an object and not rendered as text: the value is the state."""
    state = {"agent": {"autonomy": "checkpointed"}, "constraints": ["Spend under $50"]}
    rendered = render_state(
        _inputs("state"), InputState(type="input", name="state"), {"state": state}
    )
    assert rendered == state


def test_declared_inputs_need_not_all_appear_in_the_template() -> None:
    validate_inputs(_inputs("a", "unused"), _text("{{a}}"))


def _choice(*values: str, name: str = "q") -> ChoiceQuestion:
    return ChoiceQuestion(
        type="choice",
        name=name,
        instructions="Which?",
        choices=[ChoiceOption(value=value) for value in values],
    )


def _scale(levels: int, name: str = "q") -> ScaleQuestion:
    return ScaleQuestion(
        type="scale",
        name=name,
        instructions="How much?",
        levels=[ScaleLevel(label=str(level)) for level in range(levels)],
    )


def test_valid_questions_are_accepted() -> None:
    validate_questions(
        [
            PredicateQuestion(type="predicate", name="p", instructions="Is it?"),
            _choice("a", "b", name="c"),
            _scale(2, name="s"),
            _scale(10, name="t"),
            _choice(*map(str, range(255)), name="m"),
        ]
    )


@pytest.mark.parametrize(
    ("questions", "message"),
    [
        pytest.param([], "At least one question is required", id="none"),
        pytest.param(
            [PredicateQuestion(type="predicate", name=" ", instructions="Is it?")],
            "Question names cannot be empty",
            id="empty-name",
        ),
        pytest.param(
            [_choice("a", "b"), _scale(3)],
            "Question names must be unique: 'q' is repeated",
            id="duplicate-name",
        ),
        pytest.param(
            [PredicateQuestion(type="predicate", name="q", instructions=" ")],
            "Instructions for q cannot be empty",
            id="empty-instructions",
        ),
        pytest.param([_choice("a", " ")], "Choice values for q cannot be empty", id="empty-choice"),
        pytest.param([_choice("a", "a")], "Choice values for q must be unique", id="same-choice"),
        pytest.param([_choice("a")], "q needs 2 to 255 choices", id="one-choice"),
        pytest.param(
            [_choice(*map(str, range(256)))], "q needs 2 to 255 choices", id="too-many-choices"
        ),
        pytest.param([_scale(1)], "q needs 2 to 10 levels", id="one-level"),
        pytest.param([_scale(11)], "q needs 2 to 10 levels", id="too-many-levels"),
        pytest.param(
            [
                ScaleQuestion(
                    type="scale",
                    name="q",
                    instructions="How much?",
                    levels=[ScaleLevel(label="a"), ScaleLevel(label=" ")],
                )
            ],
            "Level labels for q cannot be empty",
            id="empty-level-label",
        ),
    ],
)
def test_invalid_questions_are_rejected(questions: list[DecisionQuestion], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validate_questions(questions)
