"""
Test PSI.
"""

import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal
from scipy.stats import entropy

from phoenix.metrics.drift.psi import psi


@pytest.fixture
def fixture_df(local_fixture_tmp_path_factory):
    return pd.read_excel(
        local_fixture_tmp_path_factory("psi_fixture.xlsx"),
        engine="openpyxl",
    )


@pytest.fixture
def primary_distribution(fixture_df):
    return fixture_df[[f"p{i}" for i in range(5)]].values


@pytest.fixture
def reference_distribution(fixture_df):
    return fixture_df[[f"q{i}" for i in range(5)]].values


@pytest.fixture
def expected_psi(fixture_df):
    return fixture_df["psi"].values


def test_psi_produces_expected_values_on_sample_data(
    primary_distribution, reference_distribution, expected_psi
):
    out = psi(primary_distribution, reference_distribution)
    assert_array_almost_equal(out, expected_psi)


# The following test relies on the fact that PSI(p, q) = D_KL(p, q) + D_KL(q, p).
def test_psi_equals_symmetric_kl_divergence_computed_with_scipy(
    primary_distribution, reference_distribution
):
    p_t = primary_distribution.T
    q_t = reference_distribution.T
    expected_psi = entropy(pk=p_t, qk=q_t) + entropy(pk=q_t, qk=p_t)
    out = psi(primary_distribution, reference_distribution)
    assert_array_almost_equal(out, expected_psi)
