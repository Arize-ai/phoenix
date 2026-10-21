import json
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
    "template_format,template", [("F_STRING", "{ticket}"), ("MUSTACHE", "{{ticket}}")]
)
@pytest.mark.parametrize(
    "value,expected",
    [
        ({"flag": True, "empty": None}, '{"flag": true, "empty": null}'),
        ({"a": [True]}, '{"a": [true]}'),
        ({"a": {"b": None}}, '{"a": {"b": null}}'),
        ([{"a": False}, None], '[{"a": false}, null]'),
        ({"s": "é"}, '{"s": "é"}'),
        (True, "true"),
        (None, "null"),
    ],
)
def test_structured_inputs_render_as_valid_json_in_both_formats(
    template_format: str, template: str, value: Any, expected: str
) -> None:
    rendered = render_state(_inputs("ticket"), _text(template, template_format), {"ticket": value})
    assert rendered == expected
    assert json.loads(rendered) == value


@pytest.mark.parametrize(
    "template_format,template",
    [
        ("F_STRING", "{ticket.a} {ticket.a.b} {ticket.n}"),
        ("MUSTACHE", "{{ticket.a}} {{ticket.a.b}} {{ticket.n}}"),
    ],
)
def test_dotted_paths_render_nested_values_as_json(template_format: str, template: str) -> None:
    ticket = {"a": {"b": None}, "n": None, "l": [True, {"x": False}]}
    rendered = render_state(_inputs("ticket"), _text(template, template_format), {"ticket": ticket})
    assert rendered == '{"b": null} null null'


def test_null_renders_as_json_null_in_mustache() -> None:
    # Intended: structured inputs render as JSON, so None is `null`, not empty.
    rendered = render_state(_inputs("a"), _text("[{{a}}]"), {"a": None})
    assert rendered == "[null]"


def test_f_string_dotted_paths_are_validated_by_their_root() -> None:
    validate_inputs(_inputs("ticket"), _text("{ticket.subject} {ticket[0].x}", "F_STRING"))
    with pytest.raises(ValueError, match="uses undeclared inputs: other"):
        validate_inputs(_inputs("ticket"), _text("{ticket.subject} {other.x}", "F_STRING"))


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


def test_f_string_list_indices_render_as_json() -> None:
    rendered = render_state(
        _inputs("ticket"),
        _text("{ticket[0]} {ticket[1].x} {ticket[2]}", "F_STRING"),
        {"ticket": [True, {"x": False}, None]},
    )
    assert rendered == "true false null"


@pytest.mark.parametrize(
    ("template", "values", "detail"),
    [
        pytest.param(
            "{ticket.subject}", {"ticket": {}}, "has no attribute 'subject'", id="missing-field"
        ),
        pytest.param("{ticket.subject}", {"ticket": None}, "has no attribute", id="null"),
        pytest.param("{ticket[3]}", {"ticket": [1]}, "no item 3", id="index-out-of-range"),
        pytest.param("{ticket[0]}", {"ticket": 5}, "not subscriptable", id="scalar-index"),
    ],
)
def test_f_string_paths_the_inputs_lack_are_value_errors(
    template: str, values: dict[str, Any], detail: str
) -> None:
    with pytest.raises(ValueError, match="can't be rendered from these inputs") as error:
        render_state(_inputs("ticket"), _text(template, "F_STRING"), values)
    assert detail in str(error.value)
    assert "_JSON" not in str(error.value)


def test_f_string_format_specs_apply_to_the_json_text() -> None:
    state = _text("[{ticket:>10}] [{urgent:>6}]", "F_STRING")
    assert (
        render_state(_inputs("ticket", "urgent"), state, {"ticket": {"a": 1}, "urgent": True})
        == '[  {"a": 1}] [  true]'
    )


def test_a_section_over_a_boolean_exposes_no_fields_of_its_own() -> None:
    """Inside a section over a boolean, an input named value is still that input."""
    state = _text("{{#urgent}}{{value}}{{/urgent}}")
    values = {"urgent": True, "value": "Refund my order"}
    assert render_state(_inputs("urgent", "value"), state, values) == "Refund my order"


@pytest.mark.parametrize("value", [None, True, False, "abc", 5, 1.5])
@pytest.mark.parametrize("path", ["[0]", ".title", ".count", ".upper", ".real"])
def test_f_string_scalar_paths_do_not_expose_python_values(value: Any, path: str) -> None:
    with pytest.raises(ValueError, match="can't be rendered from these inputs"):
        render_state(
            _inputs("ticket"), _text("{ticket" + path + "}", "F_STRING"), {"ticket": value}
        )


def test_f_string_numeric_object_keys_and_array_indices() -> None:
    assert (
        render_state(
            _inputs("ticket"),
            _text("{ticket[0]} {ticket.items[0].title}", "F_STRING"),
            {"ticket": {"0": "first", "items": [{"title": "Refund"}]}},
        )
        == "first Refund"
    )


def test_f_string_scalars_keep_numeric_formatting_and_plain_text() -> None:
    assert (
        render_state(
            _inputs("count", "text"),
            _text("{count:.2f} {text:>5}", "F_STRING"),
            {"count": 1.5, "text": "abc"},
        )
        == "1.50   abc"
    )


def test_boolean_section_does_not_shadow_input_named_unwrap() -> None:
    assert (
        render_state(
            _inputs("urgent", "unwrap", "_unwrap"),
            _text("{{#urgent}}{{unwrap}} {{_unwrap}}{{/urgent}}"),
            {"urgent": True, "unwrap": "hello", "_unwrap": "world"},
        )
        == "hello world"
    )


def test_mustache_lists_do_not_expose_list_methods() -> None:
    assert (
        render_state(
            _inputs("items", "empty", "nested", "pop"),
            _text("{{items.pop}}{{empty.pop}}{{items}} {{#nested}}{{pop}}{{/nested}}"),
            {"items": ["a", "b"], "empty": [], "nested": [["x"]], "pop": "outer"},
        )
        == '["a", "b"] outer'
    )


def test_f_string_numeric_input_name_renders() -> None:
    assert (
        render_state(
            _inputs("0"),
            _text("{0} {0.title}", "F_STRING"),
            {"0": {"title": "Refund"}},
        )
        == '{"title": "Refund"} Refund'
    )
