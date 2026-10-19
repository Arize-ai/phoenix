"""Decision projection policies derive output shape and reject incompatible overrides."""

from typing import Any

import pytest

from phoenix.db.types.annotation_configs import CategoricalOutputConfig, ContinuousOutputConfig
from phoenix.db.types.decision_evaluators import (
    DecisionProjectionPolicy,
    PredicateProjection,
    derive_decision_output_configs,
    resolve_projection_policy,
)
from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionQuestion,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
)


def questions() -> list[DecisionQuestion]:
    return [
        PredicateQuestion(type="predicate", name="correct", instructions="Is it correct?"),
        ChoiceQuestion(
            type="choice",
            name="route",
            instructions="Pick a route",
            choices=[ChoiceOption(value="accept"), ChoiceOption(value="review")],
        ),
        ScaleQuestion(
            type="scale",
            name="quality",
            instructions="Rate quality",
            levels=[ScaleLevel(label="low"), ScaleLevel(label="high")],
        ),
    ]


def test_output_shapes_and_default_policy_roundtrip() -> None:
    resolved = resolve_projection_policy(questions(), DecisionProjectionPolicy())
    assert DecisionProjectionPolicy.model_validate(resolved.model_dump()) == resolved
    predicate = resolved.questions["correct"]
    assert isinstance(predicate, PredicateProjection)
    assert predicate.threshold == 0.5
    configs = derive_decision_output_configs(questions(), resolved)
    assert [config.name for config in configs] == ["correct", "route", "quality"]
    assert isinstance(configs[0], ContinuousOutputConfig)
    assert isinstance(configs[1], CategoricalOutputConfig)
    assert isinstance(configs[2], ContinuousOutputConfig)
    assert configs[0].lower_bound == 0 and configs[0].upper_bound == 1
    assert [value.label for value in configs[1].values] == ["accept", "review"]
    assert configs[2].lower_bound == 0 and configs[2].upper_bound == 1


@pytest.mark.parametrize(
    "policy",
    [
        {"questions": {"correct": {"type": "predicate", "threshold": 2}}},
        {"questions": {"correct": {"type": "predicate", "threshold": float("nan")}}},
        {"questions": {"route": {"type": "choice", "scores": {"accept": float("inf")}}}},
        {"questions": {"unknown": {"type": "scale"}}},
        {"questions": {"route": {"type": "scale"}}},
        {"questions": {"route": {"type": "choice", "scores": {"missing": 1}}}},
    ],
)
def test_invalid_policies(policy: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        resolve_projection_policy(questions(), DecisionProjectionPolicy.model_validate(policy))
