"""A caller's copy of a judge's outputs is checked against the ones its policy derives."""

from typing import Optional

import pytest

from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.decision_evaluators import (
    DecisionScoringPolicy,
    PredicateScoring,
    derive_decision_output_configs,
)
from phoenix.db.types.decisions import PredicateQuestion
from phoenix.server.evaluators.services.decisions import _matches_derived_output_configs


def _derived(threshold: float) -> list[ContinuousOutputConfig]:
    configs = derive_decision_output_configs(
        [PredicateQuestion(type="predicate", name="urgent", instructions="Is it urgent?")],
        DecisionScoringPolicy(
            questions={
                "urgent": PredicateScoring(
                    type="predicate",
                    threshold=threshold,
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            }
        ),
    )
    assert all(isinstance(config, ContinuousOutputConfig) for config in configs)
    return configs  # type: ignore[return-value]


def _given(threshold: Optional[float], upper_bound: float = 1) -> ContinuousOutputConfig:
    return ContinuousOutputConfig(
        type="CONTINUOUS",
        name="urgent",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        lower_bound=0,
        upper_bound=upper_bound,
        threshold=UNDEFINED if threshold is None else threshold,
    )


@pytest.mark.parametrize(
    "given, matches",
    [
        pytest.param(_given(None), True, id="threshold-left-out"),
        pytest.param(_given(0.8), True, id="the-policys-threshold"),
        pytest.param(_given(0.3), False, id="another-threshold"),
        pytest.param(_given(None, upper_bound=5), False, id="other-bounds"),
    ],
)
def test_binding_outputs_match_the_derived_ones(
    given: ContinuousOutputConfig, matches: bool
) -> None:
    assert _matches_derived_output_configs([given], _derived(0.8)) is matches


def test_binding_outputs_must_match_in_number() -> None:
    assert not _matches_derived_output_configs([], _derived(0.8))
