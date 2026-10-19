from typing import Any

import pytest

from phoenix.db.types.decisions import (
    DecisionInput,
    DecisionState,
    InputState,
    ObjectState,
    TextState,
)
from phoenix.server.api.helpers.decision_versions import render_state, validate_inputs


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
