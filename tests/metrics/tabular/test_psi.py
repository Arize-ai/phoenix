"""
Test PSI.
"""

import os

import numpy as np
from numpy.testing import assert_array_almost_equal
import pandas as pd
import pytest
from scipy.stats import entropy

from phoenix.metrics.tabular.psi import _psi


@pytest.fixture
def psi_test_asset_df():
    return pd.read_csv(
        os.path.join(os.path.dirname(__file__), '../../assets/metrics/tabular/psi/psi_test_values.csv'))
    # return pd.read_excel(os.path.join(os.path.dirname(__file__), '../../assets/metrics/tabular/psi/psi_test_values.csv'), engine='openpyxl')


@pytest.fixture
def p(psi_test_asset_df):
    return psi_test_asset_df[[f"p{i}" for i in range(5)]].values


@pytest.fixture
def q(psi_test_asset_df):
    return psi_test_asset_df[[f"q{i}" for i in range(5)]].values


@pytest.fixture
def expected_psi(psi_test_asset_df):
    return psi_test_asset_df["psi"].values


def test__psi_returns_expected_values_for_manually_computed_examples(p, q, expected_psi):
    # Arrange.
    epsilon = 1e-7

    # Act.
    out = _psi(p, q, epsilon)

    # Assert.
    assert_array_almost_equal(out, expected_psi)


# The following test relies on the fact that PSI(p, q) = D_KL(p, q) + D_KL(q, p).
def test__psi_matches_scipy_implementation(p, q):
    # Arrange.
    p_t = p.T
    q_t = q.T
    epsilon = 1e-7
    expected_psi = entropy(pk=p_t, qk=q_t) + entropy(pk=q_t, qk=p_t)

    # Act.
    out = _psi(p, q, epsilon)

    # Assert.
    assert_array_almost_equal(out, expected_psi)


# The following test relies on the fact that PSI(p, q) = D_KL(p, q) + D_KL(q, p).
@pytest.mark.parametrize(
    "random_seed,num_dimensions,num_zero_entries",
    [(0, 2, 1), (1, 10, 3), (2, 27, 13)],
)
def test__psi_matches_scipy_implementation_when_second_distribution_has_zero_value(p, random_seed, num_dimensions, num_zero_entries):
    # Arrange.
    np.random.seed(random_seed)
    p = np.random.rand(1, num_dimensions)
    q = np.random.rand(1, num_dimensions)
    indexes = np.random.choice(np.arange(num_dimensions), num_zero_entries)  # Choose random values to set to 0.
    q[:, indexes] = 0
    p = p / np.sum(p)
    q = q / np.sum(q)
    epsilon = 1e-7
    expected_psi = entropy(pk=p, qk=q) + entropy(pk=q, qk=p)

    # Act.
    out = _psi(p, q, epsilon)

    # Assert.
    assert_array_almost_equal(out, expected_psi)
