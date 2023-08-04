from typing import List, Optional

import numpy as np
import pytest
from numpy.testing import assert_array_almost_equal
from phoenix.experimental.evals.retrievals import compute_precisions_at_k


@pytest.mark.parametrize(
    "relevance_classifications, expected_precisions_at_k",
    [
        (
            [True, True],
            [1.0, 1.0],
        ),
        (
            [True, False],
            [1.0, 0.5],
        ),
        (
            [False, True],
            [0.0, 0.5],
        ),
        (
            [False, False],
            [0.0, 0.0],
        ),
        (
            [None, True, None, False],
            [None, 1.0, 1.0, 0.5],
        ),
    ],
)
def test_compute_precisions_at_k(
    relevance_classifications: List[Optional[bool]], expected_precisions_at_k: List[Optional[float]]
) -> None:
    precisions_at_k = compute_precisions_at_k(relevance_classifications)
    precisions_at_k_array = np.array(
        [value if value is not None else np.nan for value in precisions_at_k]
    )
    expected_precisions_at_k_array = np.array(
        [value if value is not None else np.nan for value in expected_precisions_at_k]
    )
    assert_array_almost_equal(precisions_at_k_array, expected_precisions_at_k_array)
