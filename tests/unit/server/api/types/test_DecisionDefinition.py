from strawberry.scalars import JSON

from phoenix.db.types import decisions as stored
from phoenix.server.api.types.DecisionDefinition import (
    DecisionChoiceOption,
    DecisionChoiceQuestion,
    DecisionJsonState,
    DecisionPredicateCriteria,
    DecisionPredicateQuestion,
    DecisionScaleLevel,
    DecisionScaleQuestion,
    DecisionTextState,
    to_gql_decision_question,
    to_gql_decision_state,
)


def test_each_state_kind_has_an_output_type() -> None:
    assert to_gql_decision_state(
        stored.TextState(type="text", template="{{ticket}}")
    ) == DecisionTextState(text="{{ticket}}")
    for template in ({"ticket": "{{ticket}}", "n": 1}, ["{{a}}"], "{{state}}"):
        assert to_gql_decision_state(
            stored.JsonState(type="json", template=template)
        ) == DecisionJsonState(json=JSON(template))


def test_each_question_kind_has_an_output_type() -> None:
    assert to_gql_decision_question(
        stored.PredicateQuestion(
            type="predicate",
            name="urgent",
            instructions="Urgent?",
            criteria=stored.PredicateCriteria(true="Time sensitive"),
        )
    ) == DecisionPredicateQuestion(
        name="urgent",
        instructions="Urgent?",
        criteria=DecisionPredicateCriteria(true="Time sensitive", false=None),
    )
    assert to_gql_decision_question(
        stored.ChoiceQuestion(
            type="choice",
            name="team",
            instructions="Which team?",
            choices=[stored.ChoiceOption(value="billing", description="Payments")],
        )
    ) == DecisionChoiceQuestion(
        name="team",
        instructions="Which team?",
        choices=[DecisionChoiceOption(value="billing", description="Payments")],
    )
    assert to_gql_decision_question(
        stored.ScaleQuestion(
            type="scale",
            name="severity",
            instructions="How severe?",
            levels=[stored.ScaleLevel(label="low")],
        )
    ) == DecisionScaleQuestion(
        name="severity",
        instructions="How severe?",
        levels=[DecisionScaleLevel(label="low", description=None)],
    )
