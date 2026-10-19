"""Decision projection policies derive output shape and reject incompatible overrides."""

from typing import Any

import pytest

from phoenix.db.types.annotation_configs import CategoricalOutputConfig, ContinuousOutputConfig
from phoenix.db.types.decision_evaluators import (
    ChoiceProjection,
    DecisionProjectionPolicy,
    PredicateProjection,
    ScaleProjection,
    derive_decision_output_configs,
    effective_decision_policy,
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
    "policy, message",
    [
        pytest.param(
            {"questions": {"correct": {"type": "predicate", "threshold": 2}}},
            "less than or equal to 1",
            id="threshold-out-of-range",
        ),
        pytest.param(
            {"questions": {"correct": {"type": "predicate", "threshold": float("nan")}}},
            "finite number",
            id="threshold-nan",
        ),
        pytest.param(
            {"questions": {"route": {"type": "choice", "scores": {"accept": float("inf")}}}},
            "Choice scores must be finite",
            id="score-infinite",
        ),
        pytest.param(
            {"questions": {"unknown": {"type": "scale"}}},
            "Unknown projection questions: unknown",
            id="unknown-question",
        ),
        pytest.param(
            {"questions": {"route": {"type": "scale"}}},
            "Projection type for route must be choice",
            id="type-mismatch",
        ),
        pytest.param(
            {"questions": {"route": {"type": "choice", "scores": {"missing": 1}}}},
            "Unknown scored choices for route: missing",
            id="unknown-choice",
        ),
    ],
)
def test_invalid_policies(policy: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        resolve_projection_policy(questions(), DecisionProjectionPolicy.model_validate(policy))


def test_effective_policy_override_replaces_only_named_questions() -> None:
    policy = {
        "questions": {
            "correct": {"type": "predicate", "threshold": 0.9},
            "route": {"type": "choice", "scores": {"accept": 1}},
        }
    }
    override = {"questions": {"correct": {"type": "predicate", "threshold": 0.2}}}
    effective = effective_decision_policy(questions(), policy, override)
    assert effective.questions["correct"] == PredicateProjection(type="predicate", threshold=0.2)
    assert effective.questions["route"] == ChoiceProjection(type="choice", scores={"accept": 1})
    assert effective.questions["quality"] == ScaleProjection(type="scale")


def test_effective_policy_without_override_inherits_all() -> None:
    policy = {"questions": {"correct": {"type": "predicate", "threshold": 0.9}}}
    assert effective_decision_policy(questions(), policy, None) == resolve_projection_policy(
        questions(), DecisionProjectionPolicy.model_validate(policy)
    )
    assert effective_decision_policy(questions(), policy).questions["correct"] == (
        PredicateProjection(type="predicate", threshold=0.9)
    )


def test_effective_policy_rejects_unknown_override_question() -> None:
    override = {"questions": {"unknown": {"type": "scale"}}}
    with pytest.raises(ValueError, match="Unknown projection questions: unknown"):
        effective_decision_policy(questions(), {"questions": {}}, override)
