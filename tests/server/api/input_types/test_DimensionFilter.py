from typing import List, Optional

import pytest
from numpy.testing import assert_almost_equal
from phoenix.core.model_schema import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    CONTINUOUS,
    DISCRETE,
    FEATURE,
    TAG,
    Dimension,
)
from phoenix.server.api.input_types.DimensionFilter import DimensionFilter
from phoenix.server.api.types.DimensionShape import DimensionShape
from phoenix.server.api.types.DimensionType import DimensionType
from strawberry import UNSET


@pytest.mark.parametrize(
    "desired,types,shapes",
    [
        (
            [True, True, True, True, True, True],
            UNSET,
            UNSET,
        ),
        (
            [True, False, True, False, True, False],
            UNSET,
            [DimensionShape.discrete],
        ),
        (
            [False, True, False, True, False, True],
            UNSET,
            [DimensionShape.continuous],
        ),
        (
            [True, True, False, False, False, False],
            [DimensionType.actual],
            UNSET,
        ),
        (
            [True, False, False, False, False, False],
            [DimensionType.actual],
            [DimensionShape.discrete],
        ),
        (
            [False, True, False, False, False, False],
            [DimensionType.actual],
            [DimensionShape.continuous],
        ),
        (
            [True, True, False, False, True, True],
            [DimensionType.actual, DimensionType.tag],
            UNSET,
        ),
        (
            [True, False, False, False, True, False],
            [DimensionType.actual, DimensionType.tag],
            [DimensionShape.discrete],
        ),
        (
            [False, True, False, False, False, True],
            [DimensionType.actual, DimensionType.tag],
            [DimensionShape.continuous],
        ),
        (
            [False, False, True, True, True, True],
            [DimensionType.feature, DimensionType.tag],
            UNSET,
        ),
        (
            [False, False, True, False, True, False],
            [DimensionType.feature, DimensionType.tag],
            [DimensionShape.discrete],
        ),
        (
            [False, False, False, True, False, True],
            [DimensionType.feature, DimensionType.tag],
            [DimensionShape.continuous],
        ),
    ],
)
def test_dimension_filter(
    desired: List[bool],
    types: Optional[List[DimensionType]],
    shapes: Optional[List[DimensionShape]],
):
    """
    Dimensions

    A: Dimension(type=actual,  shape=discrete)
    B: Dimension(type=actual,  shape=continuous)
    C: Dimension(type=feature, shape=discrete)
    D: Dimension(type=feature, shape=continuous)
    E: Dimension(type=tag,     shape=discrete)
    F: Dimension(type=tag,     shape=continuous)

    Truth Table (✓ = True, otherwise False)

    +--------------------+----------------+---+---+---+---+---+---+
    | types              | shapes         | A | B | C | D | E | F |
    +====================+================+===+===+===+===+===+===+
    | UNSET or []        | UNSET or []    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
    | UNSET or []        | ["discrete"]   | ✓ |   | ✓ |   | ✓ |   |
    | UNSET or []        | ["continuous"] |   | ✓ |   | ✓ |   | ✓ |
    | ["actual"]         | UNSET or []    | ✓ | ✓ |   |   |   |   |
    | ["actual"]         | ["discrete"]   | ✓ |   |   |   |   |   |
    | ["actual"]         | ["continuous"] |   | ✓ |   |   |   |   |
    | ["actual", "tag"]  | UNSET or []    | ✓ | ✓ |   |   | ✓ | ✓ |
    | ["actual", "tag"]  | ["discrete"]   | ✓ |   |   |   | ✓ |   |
    | ["actual", "tag"]  | ["continuous"] |   | ✓ |   |   |   | ✓ |
    | ["tag", "feature"] | UNSET or []    |   |   | ✓ | ✓ | ✓ | ✓ |
    | ["tag", "feature"] | ["discrete"]   |   |   | ✓ |   | ✓ |   |
    | ["tag", "feature"] | ["continuous"] |   |   |   | ✓ |   | ✓ |
    +--------------------+----------------+---+---+---+---+---+---+

    """
    dimensions = [
        Dimension(
            role=role,
            data_type=data_type,
        )
        for role, data_type in (
            (ACTUAL_LABEL, DISCRETE),
            (ACTUAL_SCORE, CONTINUOUS),
            (FEATURE, DISCRETE),
            (FEATURE, CONTINUOUS),
            (TAG, DISCRETE),
            (TAG, CONTINUOUS),
        )
    ]
    assert_almost_equal(
        desired,
        list(
            map(
                DimensionFilter(
                    types=types,
                    shapes=shapes,
                ),
                dimensions,
            )
        ),
    )
