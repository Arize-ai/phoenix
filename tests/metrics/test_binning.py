import numpy as np
import pandas as pd
from numpy.testing import assert_almost_equal
from pandas.testing import assert_series_equal
from phoenix.metrics.binning import (
    AdditiveSmoothing,
    Categorical,
    Interval,
    Quantile,
)


def test_additive_smoothing() -> None:
    np.random.seed(12345)
    x, y = np.random.rand(7), np.random.rand(7)
    counts = (
        pd.Series([0, 1, 2, 3, 0, 0, 0], name="x", index=x),
        pd.Series([0, 0, 0, 3, 2, 1, 0], name="y", index=y),
    )

    for i, (desired, actual) in enumerate(
        zip(
            (
                pd.Series(
                    [0.0769, 0.1538, 0.2308, 0.3077, 0.0769, 0.0769, 0.0769], name="x", index=x
                ),
                pd.Series(
                    [0.0769, 0.0769, 0.0769, 0.3077, 0.2308, 0.1538, 0.0769], name="y", index=y
                ),
            ),
            AdditiveSmoothing(pseudocount=1)(*counts),
        )
    ):
        assert_almost_equal(actual.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual.round(4), desired)

    for i, (desired, actual) in enumerate(
        zip(
            (
                pd.Series(
                    [0.0149, 0.1642, 0.3134, 0.4627, 0.0149, 0.0149, 0.0149], name="x", index=x
                ),
                pd.Series(
                    [0.0149, 0.0149, 0.0149, 0.4627, 0.3134, 0.1642, 0.0149], name="y", index=y
                ),
            ),
            AdditiveSmoothing(pseudocount=0.1)(*counts),
        )
    ):
        assert_almost_equal(actual.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual.round(4), desired)

    for i, (desired, actual) in enumerate(
        zip(
            (
                pd.Series([0, 0.1667, 0.3333, 0.5, 0, 0, 0], name="x", index=x),
                pd.Series([0, 0, 0, 0.5, 0.3333, 0.1667, 0], name="y", index=y),
            ),
            AdditiveSmoothing(pseudocount=0)(*counts),
        )
    ):
        assert_almost_equal(actual.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual.round(4), desired)


data = pd.Series([-1, 0, 1, 2, 3, None, ""], dtype=object)


def test_categorical_binning() -> None:
    assert_series_equal(
        Categorical().histogram(data),
        data.replace((None, ""), pd.NA).value_counts(dropna=False),
    )
    assert_series_equal(
        Categorical(dropna=True).histogram(data),
        data.replace((None, ""), pd.NA).value_counts(),
    )
    assert_series_equal(
        Categorical(special_missing_values=(-1,)).histogram(data),
        data.replace((None, "", -1), pd.NA).value_counts(dropna=False),
    )
    assert_series_equal(
        Categorical(special_missing_values=(-1,), dropna=True).histogram(data),
        data.replace((None, "", -1), pd.NA).value_counts(),
    )


def test_interval_binning() -> None:
    bins = pd.IntervalIndex(
        (
            pd.Interval(float("-inf"), 1.0, closed="left"),
            pd.Interval(1.0, 2.0, closed="left"),
            pd.Interval(2.0, float("inf"), closed="left"),
        )
    )

    assert_series_equal(
        Interval(bins=bins).histogram(data),
        pd.cut(data, bins).value_counts(dropna=False),
    )
    assert_series_equal(
        Interval(bins=bins, dropna=True).histogram(data),
        pd.cut(data, bins).value_counts(),
    )
    assert_series_equal(
        Interval(bins=bins, special_missing_values=(-1,)).histogram(data),
        pd.cut(data.replace(-1, pd.NA), bins).value_counts(dropna=False),
    )
    assert_series_equal(
        Interval(bins=bins, special_missing_values=(-1,), dropna=True).histogram(data),
        pd.cut(data.replace(-1, pd.NA), bins).value_counts(),
    )


def test_quantile_binning() -> None:
    prob = (0.25, 0.5, 0.75)

    bins = pd.IntervalIndex(
        (
            pd.Interval(float("-inf"), 0.0, closed="left"),
            pd.Interval(0.0, 1.0, closed="left"),
            pd.Interval(1.0, 2.0, closed="left"),
            pd.Interval(2.0, float("inf"), closed="left"),
        )
    )
    assert_series_equal(
        Quantile(probabilities=prob).histogram(data),
        pd.cut(data, bins).value_counts(dropna=False),
    )
    assert_series_equal(
        Quantile(probabilities=prob, dropna=True).histogram(data),
        pd.cut(data, bins).value_counts(),
    )

    bins = pd.IntervalIndex(
        (
            pd.Interval(float("-inf"), 0.75, closed="left"),
            pd.Interval(0.75, 1.5, closed="left"),
            pd.Interval(1.5, 2.25, closed="left"),
            pd.Interval(2.25, float("inf"), closed="left"),
        )
    )
    assert_series_equal(
        Quantile(probabilities=prob, special_missing_values=(-1,)).histogram(data),
        pd.cut(data.replace(-1, pd.NA), bins).value_counts(dropna=False),
    )
    assert_series_equal(
        Quantile(probabilities=prob, special_missing_values=(-1,), dropna=True).histogram(data),
        pd.cut(data.replace(-1, pd.NA), bins).value_counts(),
    )
