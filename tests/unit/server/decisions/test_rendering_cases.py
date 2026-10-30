"""The server runs every decision rendering vector.

The vectors in ``rendering_cases.json`` beside this file are kept as data so a client
that renders decisions itself can run the same cases.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import TypeAdapter

from phoenix.db.types.decisions import DecisionQuestion, DecisionState, JsonState, TextState
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.decisions.rendering import decision_variables, render_decision, whole_tag_path
from phoenix.server.decisions.validation import validate_template

_CASES_PATH = Path(__file__).parent / "rendering_cases.json"
_FILE: dict[str, Any] = json.loads(_CASES_PATH.read_text())
_CASES: list[dict[str, Any]] = _FILE["cases"]
_STATE = TypeAdapter(DecisionState)
_QUESTIONS = TypeAdapter(list[DecisionQuestion])


def _dump_questions(questions: Any) -> Any:
    return [question.model_dump(mode="json") for question in questions]


def test_every_case_has_one_outcome() -> None:
    names = [case["name"] for case in _CASES]
    assert len(names) == len(set(names))
    for case in _CASES:
        assert ("expected" in case) != ("error" in case), case["name"]


@pytest.mark.parametrize("case", _CASES, ids=[case["name"] for case in _CASES])
def test_rendering_case(case: dict[str, Any]) -> None:
    template_format = PromptTemplateFormat(case["template_format"])
    state = _STATE.validate_python(case["state"])
    questions = _QUESTIONS.validate_python(case["questions"])
    if "derived_variables" in case:
        assert decision_variables(template_format, state, questions) == case["derived_variables"]
    if "error" in case:
        with pytest.raises(ValueError) as error:
            render_decision(template_format, state, questions, case["variables"])
        assert case["error"] in str(error.value)
        return
    rendered = render_decision(template_format, state, questions, case["variables"])
    assert rendered.state == case["expected"]["state"]
    # Types are kept exactly: 1 and 1.0, or 0 and False, are different results.
    assert json.dumps(rendered.state) == json.dumps(case["expected"]["state"])
    assert _dump_questions(rendered.questions) == _dump_questions(
        _QUESTIONS.validate_python(case["expected"]["questions"])
    )
    # Rendering leaves the stored definition untouched.
    assert state == _STATE.validate_python(case["state"])
    assert questions == _QUESTIONS.validate_python(case["questions"])


class TestValidateTemplate:
    @pytest.mark.parametrize(
        "state, message",
        [
            pytest.param(TextState(type="text", template="  "), "cannot be empty", id="blank-text"),
            pytest.param(JsonState(type="json", template=""), "cannot be empty", id="empty-string"),
            pytest.param(JsonState(type="json", template=5), "must be an object", id="number"),
            pytest.param(JsonState(type="json", template=True), "must be an object", id="bool"),
            pytest.param(JsonState(type="json", template=None), "must be an object", id="null"),
            pytest.param(
                TextState(type="text", template="{{#a}}"), "Invalid template", id="unparseable"
            ),
        ],
    )
    def test_rejects(self, state: DecisionState, message: str) -> None:
        with pytest.raises(ValueError, match=message):
            validate_template(PromptTemplateFormat.MUSTACHE, state, [])

    @pytest.mark.parametrize(
        "template",
        [{}, [], {"a": "{{a}}"}, ["{{a}}", 1], "{{state}}", "Literal text"],
    )
    def test_accepts_objects_lists_and_strings(self, template: Any) -> None:
        validate_template(
            PromptTemplateFormat.MUSTACHE, JsonState(type="json", template=template), []
        )

    def test_returns_variables_and_checks_question_templates(self) -> None:
        questions = _QUESTIONS.validate_python(
            [{"type": "predicate", "name": "ok", "instructions": "Is {who ok?"}]
        )
        with pytest.raises(ValueError, match="Invalid template in the instructions of ok"):
            validate_template(
                PromptTemplateFormat.F_STRING, TextState(type="text", template="{a}"), questions
            )
        assert validate_template(
            PromptTemplateFormat.MUSTACHE, TextState(type="text", template="{{a}} {{b.c}}"), []
        ) == ["a", "b"]


def test_variables_are_named_as_prompts_name_them() -> None:
    # The playground and prompts read a variable from `{{.}}`, so the server does too.
    state = TextState(type="text", template="{{.}} and {{#items}}{{name}}{{/items}} for {{a.b}}")
    assert decision_variables(PromptTemplateFormat.MUSTACHE, state, []) == [".", "items", "a"]


@pytest.mark.parametrize(
    "case", _FILE["whole_tags"], ids=lambda case: f"{case['template_format']} {case['text']}"
)
def test_whole_tag_case(case: dict[str, Any]) -> None:
    template_format = PromptTemplateFormat(case["template_format"])
    assert whole_tag_path(template_format, case["text"]) == case["path"]
