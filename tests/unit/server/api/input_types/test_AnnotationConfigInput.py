from typing import Optional

import pytest

from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
    ContinuousAnnotationConfigInput,
)


def _input(threshold: Optional[float]) -> AnnotationConfigInput:
    return AnnotationConfigInput(
        continuous=ContinuousAnnotationConfigInput(
            name="helpfulness",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            lower_bound=0,
            upper_bound=10,
            threshold=threshold,
        )
    )


def test_continuous_output_config_carries_the_threshold() -> None:
    config = _input(7.0).to_output_config()
    assert isinstance(config, ContinuousOutputConfig)
    assert config.threshold == 7.0
    assert config.model_dump()["threshold"] == 7.0


def test_continuous_output_config_without_threshold_serializes_as_before() -> None:
    config = _input(None).to_output_config()
    assert isinstance(config, ContinuousOutputConfig)
    assert config.threshold is None
    assert config.model_dump() == {
        "name": "helpfulness",
        "description": None,
        "type": "CONTINUOUS",
        "optimization_direction": OptimizationDirection.MAXIMIZE,
        "lower_bound": 0,
        "upper_bound": 10,
    }


@pytest.mark.parametrize("threshold", [0.0, 10.0, -3.0])
def test_threshold_outside_the_bounds_is_a_bad_request(threshold: float) -> None:
    with pytest.raises(BadRequest, match="Invalid output config 'helpfulness'"):
        _input(threshold).to_output_config()
