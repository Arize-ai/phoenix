"""Decision scoring policies derive output shape and reject incompatible overrides."""

from typing import Any

import pytest
from pydantic import TypeAdapter
from sqlalchemy.dialects import sqlite

from phoenix.db.models import _OutputConfigList
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfig,
    OutputConfigType,
)
from phoenix.db.types.decision_evaluators import (
    ChoiceScoring,
    DecisionScoringPolicy,
    PredicateScoring,
    ScaleScoring,
    adapt_scoring_policy,
    derive_decision_output_configs,
    resolve_scoring_policy,
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
            levels=[
                ScaleLevel(label="low"),
                ScaleLevel(label="medium"),
                ScaleLevel(label="high"),
            ],
        ),
    ]


def test_output_shapes_and_default_policy_roundtrip() -> None:
    resolved = resolve_scoring_policy(questions(), DecisionScoringPolicy())
    assert DecisionScoringPolicy.model_validate(resolved.model_dump()) == resolved
    predicate = resolved.questions["correct"]
    assert isinstance(predicate, PredicateScoring)
    assert predicate.threshold == 0.5
    configs = derive_decision_output_configs(questions(), resolved)
    assert [config.name for config in configs] == ["correct", "route", "quality"]
    assert isinstance(configs[0], ContinuousOutputConfig)
    assert isinstance(configs[1], CategoricalOutputConfig)
    assert isinstance(configs[2], ContinuousOutputConfig)
    assert configs[0].lower_bound == 0 and configs[0].upper_bound == 1
    assert [value.label for value in configs[1].values] == ["accept", "review"]
    assert configs[2].lower_bound == 0 and configs[2].upper_bound == 2


def test_predicate_output_carries_its_threshold_but_never_serializes_it() -> None:
    policy = DecisionScoringPolicy(
        questions={
            "correct": PredicateScoring(
                type="predicate",
                threshold=0.8,
                optimization_direction=OptimizationDirection.MAXIMIZE,
            )
        }
    )
    predicate, _, scale = derive_decision_output_configs(questions(), policy)
    assert isinstance(predicate, ContinuousOutputConfig)
    assert isinstance(scale, ContinuousOutputConfig)
    assert predicate.threshold == 0.8
    assert predicate.optimization_direction is OptimizationDirection.MAXIMIZE
    assert scale.threshold is None
    # The threshold is the scoring policy's: stored snapshots, binding checks and
    # online-eval fingerprints serialize derived outputs, and must not change with it.
    for config in (predicate, scale):
        assert "threshold" not in config.model_dump()
        assert "threshold" not in config.model_dump(mode="json")
    assert (
        predicate.model_dump()
        == ContinuousOutputConfig.model_validate(predicate.model_dump()).model_dump()
    )


def test_storage_dumps_leave_out_a_predicates_threshold() -> None:
    # The model's own dump leaves out every unset field, so it cannot show this. The
    # dumps that reach JSON columns and snapshots wrap the config, and only the
    # config's serializer keeps a derived threshold out of them. At 1.0, a leaked one
    # would also fail to reload, as a saved threshold on a bound.
    policy = DecisionScoringPolicy(
        questions={"correct": PredicateScoring(type="predicate", threshold=1.0)}
    )
    configs = derive_decision_output_configs(questions(), policy)
    predicate = configs[0]
    assert isinstance(predicate, ContinuousOutputConfig)
    assert predicate.threshold == 1.0
    stored = [
        OutputConfig(root=predicate).model_dump(),
        OutputConfig(root=predicate).model_dump(mode="json"),
        TypeAdapter(list[OutputConfigType]).dump_python(configs)[0],
        _OutputConfigList().process_bind_param(configs, sqlite.dialect())[0],  # type: ignore[index]
    ]
    for dump in stored:
        assert "threshold" not in dump
        assert OutputConfig.model_validate(dump).root.threshold is None  # type: ignore[union-attr]


@pytest.mark.parametrize("threshold", [0.0, 1.0])
def test_predicate_threshold_may_sit_on_a_bound(threshold: float) -> None:
    # A saved continuous threshold must lie strictly inside the bounds; a
    # predicate's may not, and deriving its output must not fail.
    policy = DecisionScoringPolicy(
        questions={"correct": PredicateScoring(type="predicate", threshold=threshold)}
    )
    predicate, _, _ = derive_decision_output_configs(questions(), policy)
    assert isinstance(predicate, ContinuousOutputConfig)
    assert predicate.threshold == threshold
    # Stored or echoed back, it still validates: the threshold is not in the dump.
    assert ContinuousOutputConfig.model_validate(predicate.model_dump()).threshold is None


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
            "Unknown scoring questions: unknown",
            id="unknown-question",
        ),
        pytest.param(
            {"questions": {"route": {"type": "scale"}}},
            "Scoring type for route must be choice",
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
        resolve_scoring_policy(questions(), DecisionScoringPolicy.model_validate(policy))


def test_adapt_scoring_policy_adapts_policy_to_updated_questions() -> None:
    prior = DecisionScoringPolicy.model_validate(
        {
            "questions": {
                "correct": {"type": "predicate", "threshold": 0.8},
                "route": {
                    "type": "choice",
                    "scores": {"accept": 1.0, "review": 0.5, "legacy": -1.0},
                },
                "quality": {"type": "scale", "include_label": True},
                "removed": {"type": "predicate", "threshold": 0.2},
            }
        }
    )
    updated_questions: list[DecisionQuestion] = [
        PredicateQuestion(type="predicate", name="correct", instructions="Is it correct?"),
        ChoiceQuestion(
            type="choice",
            name="route",
            instructions="Pick a route",
            choices=[ChoiceOption(value="accept"), ChoiceOption(value="escalate")],
        ),
        # Type changed from scale -> predicate; old scale scoring is replaced by default.
        PredicateQuestion(type="predicate", name="quality", instructions="Pass quality?"),
        ScaleQuestion(
            type="scale",
            name="fresh",
            instructions="New scale",
            levels=[ScaleLevel(label="a"), ScaleLevel(label="b")],
        ),
    ]
    fitted = adapt_scoring_policy(updated_questions, prior)
    assert set(fitted.questions) == {"correct", "route", "quality", "fresh"}
    assert fitted.questions["correct"] == PredicateScoring(type="predicate", threshold=0.8)
    assert fitted.questions["route"] == ChoiceScoring(type="choice", scores={"accept": 1.0})
    assert fitted.questions["quality"] == PredicateScoring(type="predicate", threshold=0.5)
    assert fitted.questions["fresh"] == ScaleScoring(type="scale", include_label=False)
