from typing import cast

import pytest

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.dataset_evaluator_service import validate_llm_binding_overrides
from phoenix.server.api.routers.v1.annotation_config_models import (
    CategoricalAnnotationConfigData,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfigData,
    FreeformAnnotationConfigData,
)
from phoenix.server.api.routers.v1.evaluator_common import output_configs_to_db


def test_inverted_continuous_bounds_are_a_client_error() -> None:
    config = ContinuousAnnotationConfigData(
        name="score",
        type="CONTINUOUS",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        lower_bound=1,
        upper_bound=0,
    )
    with pytest.raises(BadRequest, match="Lower bound must be strictly less than upper bound"):
        output_configs_to_db([config])


def test_duplicate_categorical_labels_are_a_client_error() -> None:
    config = CategoricalAnnotationConfigData(
        name="label",
        type="CATEGORICAL",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        values=[
            CategoricalAnnotationValue(label="yes", score=1),
            CategoricalAnnotationValue(label="yes", score=0),
        ],
    )
    with pytest.raises(BadRequest, match="duplicate label"):
        output_configs_to_db([config])


def test_inverted_freeform_bounds_are_a_client_error() -> None:
    config = FreeformAnnotationConfigData(
        name="note",
        type="FREEFORM",
        lower_bound=5,
        upper_bound=5,
    )
    with pytest.raises(BadRequest, match="Lower bound must be strictly less than upper bound"):
        output_configs_to_db([config])


def test_non_categorical_llm_binding_override_is_a_client_error() -> None:
    config = ContinuousOutputConfig(
        type="CONTINUOUS",
        name="score",
        optimization_direction=OptimizationDirection.MAXIMIZE,
    )
    with pytest.raises(BadRequest, match="CategoricalOutputConfig"):
        validate_llm_binding_overrides(cast(models.PromptVersion, object()), [config], None)
