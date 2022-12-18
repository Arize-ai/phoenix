"""
Test percent empty.
"""

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal

from phoenix.metrics.percent_empty import percent_empty


@pytest.fixture
def random_seed():
    np.random.seed(0)


def test_percent_empty_returns_expected_values_on_range_of_percents_including_0_and_100(
    random_seed,
):
    num_features = 11
    num_samples = 100
    column_names = [f"feature{index}" for index in range(num_features)]
    num_empty_list = [10 * index for index in range(11)]
    data = {}
    for column_name, num_empty in zip(column_names, num_empty_list):
        empty_mask = np.random.choice(np.arange(num_samples), num_empty, replace=False)
        column = np.random.rand(num_samples)
        column[empty_mask] = np.nan
        data[column_name] = column
    df = pd.DataFrame.from_dict(data)
    out = percent_empty(df)
    assert_array_almost_equal(out.values, np.linspace(0, 1, 11))
