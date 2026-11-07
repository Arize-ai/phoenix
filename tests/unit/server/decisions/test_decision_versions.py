import json
from typing import Any

import pytest

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionQuestion,
    JsonState,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
    TextState,
)
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.decisions.rendering import render_decision
from phoenix.server.decisions.validation import validate_questions, validate_template


def _render(template: str, values: dict[str, Any], template_format: str = "MUSTACHE") -> Any:
    return render_decision(
        PromptTemplateFormat(template_format), TextState(type="text", template=template), [], values
    ).state


def test_json_state_sends_variables_with_their_types() -> None:
    values = {"ticket": {"body": "Refund?", "tags": ["billing"]}, "plan": None, "extra": 1}
    state = JsonState(type="json", template={"ticket": "{{ticket}}", "plan": "{{plan}}"})
    rendered = render_decision(PromptTemplateFormat.MUSTACHE, state, [], values)
    assert rendered.state == {"ticket": values["ticket"], "plan": None}


def test_missing_variables_are_named_and_extras_ignored() -> None:
    with pytest.raises(ValueError, match="Missing variables: plan"):
        _render("{{ticket}} {{plan}}", {"ticket": "x", "plna": "pro"})
    assert _render("{{ticket}}", {"ticket": "x", "extra": 1}) == "x"


def test_mustache_renders_structured_values_as_json_and_still_reads_into_them() -> None:
    template = (
        "{{ticket}} | {{ticket.body}} | {{#tags}}<{{.}}>{{/tags}} | "
        "{{flag}} {{^flag}}off{{/flag}} | {{missing}}{{^missing}}none{{/missing}}"
    )
    rendered = _render(
        template,
        {
            "ticket": {"body": "Refund?", "vip": True},
            "tags": ["a", "b"],
            "flag": False,
            "missing": None,
        },
    )
    assert rendered == '{"body": "Refund?", "vip": true} | Refund? | <a><b> | false off | nullnone'


def test_f_string_renders_structured_values_as_json() -> None:
    rendered = _render(
        "Ticket: {ticket} ({count})", {"ticket": {"body": "Refund?"}, "count": 2}, "F_STRING"
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
    ],
)
def test_structured_values_render_as_valid_json_in_both_formats(
    template_format: str, template: str, value: Any, expected: str
) -> None:
    rendered = _render("Value: " + template, {"ticket": value}, template_format)
    assert rendered == "Value: " + expected
    assert json.loads(rendered.removeprefix("Value: ")) == value


@pytest.mark.parametrize(
    "template_format,template",
    [
        ("F_STRING", "{ticket.a} {ticket.a.b} {ticket.n}"),
        ("MUSTACHE", "{{ticket.a}} {{ticket.a.b}} {{ticket.n}}"),
    ],
)
def test_dotted_paths_render_nested_values_as_json(template_format: str, template: str) -> None:
    ticket = {"a": {"b": None}, "n": None, "l": [True, {"x": False}]}
    assert _render(template, {"ticket": ticket}, template_format) == '{"b": null} null null'


def test_null_renders_as_json_null_in_mustache() -> None:
    # Intended: structured values render as JSON, so None is `null`, not empty.
    assert _render("[{{a}}]", {"a": None}) == "[null]"


@pytest.mark.parametrize(
    "state,message",
    [
        (TextState(type="text", template="  "), "The state template cannot be empty"),
        (TextState(type="text", template="{{#a}}"), "Invalid template in the state"),
        (JsonState(type="json", template=1), "must be an object, a list, or a string"),
    ],
)
def test_invalid_state_templates_are_rejected(state: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validate_template(PromptTemplateFormat.MUSTACHE, state, [])


def test_whole_value_state_is_one_value_unchanged() -> None:
    """Not wrapped in an object and not rendered as text: the value is the state."""
    state = {"agent": {"autonomy": "checkpointed"}, "constraints": ["Spend under $50"]}
    rendered = render_decision(
        PromptTemplateFormat.MUSTACHE,
        JsonState(type="json", template="{{state}}"),
        [],
        {"state": state},
    )
    assert rendered.state == state


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
    rendered = _render(
        "{ticket[0]} {ticket[1].x} {ticket[2]}",
        {"ticket": [True, {"x": False}, None]},
        "F_STRING",
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
def test_f_string_paths_the_variables_lack_are_value_errors(
    template: str, values: dict[str, Any], detail: str
) -> None:
    with pytest.raises(ValueError, match="Can't render the state") as error:
        _render(template, values, "F_STRING")
    assert detail in str(error.value)
    assert "_JSON" not in str(error.value)


def test_f_string_format_specs_apply_to_the_json_text() -> None:
    assert (
        _render("[{ticket:>10}] [{urgent:>6}]", {"ticket": {"a": 1}, "urgent": True}, "F_STRING")
        == '[  {"a": 1}] [  true]'
    )


def test_a_section_over_a_boolean_exposes_no_fields_of_its_own() -> None:
    """Inside a section over a boolean, a variable named value is still that variable."""
    values = {"urgent": True, "value": "Refund my order"}
    assert _render("{{#urgent}}{{value}}{{/urgent}}", values) == "Refund my order"


@pytest.mark.parametrize("value", [None, True, False, "abc", 5, 1.5])
@pytest.mark.parametrize("path", ["[0]", ".title", ".count", ".upper", ".real"])
def test_f_string_scalar_paths_do_not_expose_python_values(value: Any, path: str) -> None:
    with pytest.raises(ValueError, match="Can't render the state"):
        _render("x {ticket" + path + "}", {"ticket": value}, "F_STRING")


def test_f_string_numeric_object_keys_and_array_indices() -> None:
    assert (
        _render(
            "{ticket[0]} {ticket.items[0].title}",
            {"ticket": {"0": "first", "items": [{"title": "Refund"}]}},
            "F_STRING",
        )
        == "first Refund"
    )


def test_f_string_scalars_keep_numeric_formatting_and_plain_text() -> None:
    assert (
        _render("{count:.2f} {text:>5}", {"count": 1.5, "text": "abc"}, "F_STRING") == "1.50   abc"
    )


def test_boolean_section_does_not_shadow_variable_named_unwrap() -> None:
    assert (
        _render(
            "{{#urgent}}{{unwrap}} {{_unwrap}}{{/urgent}}",
            {"urgent": True, "unwrap": "hello", "_unwrap": "world"},
        )
        == "hello world"
    )


def test_mustache_lists_do_not_expose_list_methods() -> None:
    assert (
        _render(
            "{{items.pop}}{{empty.pop}}{{items}} {{#nested}}{{pop}}{{/nested}}",
            {"items": ["a", "b"], "empty": [], "nested": [["x"]], "pop": "outer"},
        )
        == '["a", "b"] outer'
    )


def test_f_string_numeric_variable_name_renders() -> None:
    assert (
        _render("{0} {0.title}", {"0": {"title": "Refund"}}, "F_STRING")
        == '{"title": "Refund"} Refund'
    )
