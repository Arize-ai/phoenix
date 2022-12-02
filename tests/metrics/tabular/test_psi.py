"""
Test PSI.
"""

import os

from numpy.testing import assert_array_almost_equal
import pandas as pd
import pytest
from scipy.stats import entropy

from phoenix.metrics.tabular.psi import _psi


@pytest.fixture
def psi_test_asset_df(request):
    return pd.read_excel(
        os.path.join(
            request.config.invocation_dir,
            "assets/metrics/tabular/psi/psi_test_asset.xlsx",
        ),
        engine="openpyxl",
    )


@pytest.fixture
def p(psi_test_asset_df):
    return psi_test_asset_df[[f"p{i}" for i in range(5)]].values


@pytest.fixture
def q(psi_test_asset_df):
    return psi_test_asset_df[[f"q{i}" for i in range(5)]].values


@pytest.fixture
def expected_psi(psi_test_asset_df):
    return psi_test_asset_df["psi"].values


def test__psi_matches_spreadsheet_examples(p, q, expected_psi):
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
