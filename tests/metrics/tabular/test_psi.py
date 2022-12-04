"""
Test PSI.
"""

import os

import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal
from scipy.stats import entropy

from phoenix.metrics.tabular.psi import _psi


@pytest.fixture
def fixture_df(fixtures_dir):
    return pd.read_excel(
        os.path.join(fixtures_dir, "psi_fixture.xlsx"),
        engine="openpyxl",
    )


@pytest.fixture
def distribution_p(fixture_df):
    return fixture_df[[f"p{i}" for i in range(5)]].values


@pytest.fixture
def distribution_q(fixture_df):
    return fixture_df[[f"q{i}" for i in range(5)]].values


@pytest.fixture
def expected_psi(fixture_df):
    return fixture_df["psi"].values


def test__psi_matches_spreadsheet_examples(distribution_p, distribution_q, expected_psi):
    # Arrange
    epsilon = 1e-7

    # Act
    out = _psi(distribution_p, distribution_q, epsilon)

    # Assert
    assert_array_almost_equal(out, expected_psi)


# The following test relies on the fact that PSI(p, q) = D_KL(p, q) + D_KL(q, p).
def test__psi_matches_scipy_implementation(distribution_p, distribution_q):
    # Arrange
    p_t = distribution_p.T
    q_t = distribution_q.T
    epsilon = 1e-7
    expected_psi = entropy(pk=p_t, qk=q_t) + entropy(pk=q_t, qk=p_t)

    # Act
    out = _psi(distribution_p, distribution_q, epsilon)

    # Assert
    assert_array_almost_equal(out, expected_psi)
