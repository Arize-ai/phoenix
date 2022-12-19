"""
Test binning.
"""

import numpy as np
import pandas as pd
import pytest
from numpy.random import default_rng
from numpy.testing import assert_array_almost_equal
from scipy.stats import beta, expon, gamma, norm

from phoenix.datasets.binning import compute_default_bins, compute_histogram


@pytest.fixture
def random_number_generator():
    random_seed = 0
    return default_rng(seed=random_seed)


@pytest.fixture(params=[beta(1.5, 1.2), expon(), gamma(1.5), norm()])
def random_variable(request):
    return request.param


@pytest.fixture
def random_sample(random_number_generator, random_variable):
    num_samples = 10**5
    return random_variable.rvs(size=num_samples, random_state=random_number_generator)


def test_compute_default_bins_produces_expected_bin_boundaries_for_synthetic_data(
    random_number_generator, random_variable, random_sample
):
    data = {"feature0": random_sample}
    df = pd.DataFrame.from_dict(data)
    median = random_variable.median()
    std = random_variable.std()
    expected_bin_boundaries = np.concatenate(
        [
            np.array([-np.inf]),
            np.linspace(-(4 / 3) * std + median, (4 / 3) * std + median, 9),
            np.array([np.inf])
        ]
    )

    bins_df = compute_default_bins(df)
    assert bins_df.shape == (11, 1)
    assert bins_df.columns == df.columns
    bin_boundaries = bins_df.values.squeeze()
    assert_array_almost_equal(bin_boundaries, expected_bin_boundaries, decimal=2)


def test_compute_histogram_with_decile_bin_boundaries_produces_histogram_that_matches_cdf(
    random_number_generator, random_variable, random_sample
):
    data = {"feature0": random_sample}
    df = pd.DataFrame.from_dict(data)
    decile_bins = random_variable.ppf(np.linspace(0.0, 1.0, 11))
    bins_df = pd.DataFrame.from_dict({"feature0": decile_bins})
    expected_cdf = np.linspace(0.1, 1, 10)
    histogram = compute_histogram(df, bins_df)
    empirical_cdf = np.cumsum(histogram / histogram.sum())
    empirical_cdf = empirical_cdf.values.squeeze()
    assert_array_almost_equal(empirical_cdf, expected_cdf, decimal=2)
