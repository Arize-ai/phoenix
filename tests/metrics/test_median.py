"""
Test median.
"""

import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal, assert_array_equal
from phoenix.metrics.median import median


@pytest.fixture(
    params=["median_even_num_samples_fixture.csv", "median_odd_num_samples_fixture.csv"]
)
def median_fixture_df(request, local_fixture_tmp_path_factory):
    return pd.read_csv(local_fixture_tmp_path_factory(request.param), index_col=False)


@pytest.fixture
def features_df(median_fixture_df):
    return median_fixture_df[[f"feature{index}" for index in range(5)]]


@pytest.fixture
def expected_medians_column(median_fixture_df):
    return median_fixture_df[[f"median{index}" for index in range(5)]].iloc[0]


def test_median_produces_expected_output_for_both_even_and_odd_number_of_samples(
    features_df, expected_medians_column
):
    medians_column = median(features_df)
    assert_array_equal(medians_column.index.values, features_df.columns)
    assert_array_almost_equal(medians_column.values, expected_medians_column.values)
