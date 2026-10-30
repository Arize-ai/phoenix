import pytest
from strawberry.scalars import JSON

from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.DecisionConnectionInput import (
    BuiltInDecisionConnectionInput,
    DecisionConnectionInput,
)
from phoenix.server.api.input_types.DecisionTaskInput import DecisionTaskInput
from phoenix.server.api.input_types.DecisionVersionInput import (
    ChoiceOptionInput,
    ChoiceQuestionInput,
    DecisionQuestionInput,
    DecisionStateInput,
    PredicateQuestionInput,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


def _task(
    *,
    questions: list[DecisionQuestionInput],
) -> DecisionTaskInput:
    return DecisionTaskInput(
        connection=DecisionConnectionInput(
            built_in=BuiltInDecisionConnectionInput(provider_key=GenerativeProviderKey.OPENAI)
        ),
        model_name="model",
        template_format=PromptTemplateFormat.MUSTACHE,
        state=DecisionStateInput(json=JSON({"ticket": "{{ticket}}"})),
        questions=questions,
    )


def _question() -> DecisionQuestionInput:
    return DecisionQuestionInput(
        predicate=PredicateQuestionInput(name="urgent", instructions="Is it urgent?")
    )


def test_inline_questions_become_the_configs_questions() -> None:
    config = _task(questions=[_question()]).to_config()
    assert [question.name for question in config.questions] == ["urgent"]


def test_empty_questions_are_rejected() -> None:
    with pytest.raises(BadRequest, match="At least one question is required"):
        _task(questions=[]).to_config()


def test_invalid_inline_question_is_rejected() -> None:
    with pytest.raises(BadRequest, match="route needs 2 to 255 choices"):
        _task(
            questions=[
                DecisionQuestionInput(
                    choice=ChoiceQuestionInput(
                        name="route",
                        instructions="Route it",
                        choices=[ChoiceOptionInput(value="only-one")],
                    )
                )
            ]
        ).to_config()


def test_the_config_copies_the_template_and_the_variables_path() -> None:
    task = _task(questions=[_question()])
    task.template_variables_path = "reference"
    config = task.to_config()
    assert config.template_format is PromptTemplateFormat.MUSTACHE
    assert config.state.model_dump() == {"type": "json", "template": {"ticket": "{{ticket}}"}}
    assert config.template_variables_path == "reference"


def test_a_scalar_json_template_is_rejected() -> None:
    task = _task(questions=[_question()])
    task.state = DecisionStateInput(json=JSON(3))
    with pytest.raises(BadRequest, match="must be an object, a list, or a string"):
        task.to_config()
