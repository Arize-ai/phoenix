import pytest

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.DecisionConnectionInput import (
    BuiltInDecisionConnectionInput,
    DecisionConnectionInput,
)
from phoenix.server.api.input_types.DecisionTaskInput import DecisionTaskInput
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionInputDefinitionInput,
    DecisionQuestionInput,
    DecisionStateInput,
    PredicateQuestionInput,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


def _task(
    *,
    questions: list[DecisionQuestionInput],
    questions_path: str | None = None,
) -> DecisionTaskInput:
    return DecisionTaskInput(
        connection=DecisionConnectionInput(
            built_in=BuiltInDecisionConnectionInput(provider_key=GenerativeProviderKey.OPENAI)
        ),
        model_name="model",
        inputs=[DecisionInputDefinitionInput(name="ticket")],
        state=DecisionStateInput(input="ticket"),
        questions=questions,
        questions_path=questions_path,
    )


def _question() -> DecisionQuestionInput:
    return DecisionQuestionInput(
        predicate=PredicateQuestionInput(name="urgent", instructions="Is it urgent?")
    )


def test_inline_questions_become_the_configs_questions() -> None:
    config = _task(questions=[_question()]).to_config()
    assert [question.name for question in config.questions] == ["urgent"]
    assert config.questions_path is None


def test_a_questions_path_alone_leaves_the_inline_questions_empty() -> None:
    config = _task(questions=[], questions_path="questions").to_config()
    assert config.questions == []
    assert config.questions_path == "questions"


def test_questions_and_a_questions_path_together_are_rejected() -> None:
    with pytest.raises(BadRequest) as excinfo:
        _task(questions=[_question()], questions_path="questions").to_config()
    assert str(excinfo.value) == (
        "Give questions or a questionsPath, not both: each example's questions replace the task's"
    )


def test_neither_questions_nor_a_questions_path_is_rejected() -> None:
    with pytest.raises(BadRequest, match="At least one question is required"):
        _task(questions=[]).to_config()
