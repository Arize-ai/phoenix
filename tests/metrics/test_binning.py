import math
from dataclasses import MISSING
from typing import Any, List, Tuple, cast

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_almost_equal
from pandas.testing import assert_series_equal
from phoenix.core.model_schema import Column
from phoenix.metrics import Metric, binning
from phoenix.metrics.metrics import Count, CountNotNull, Max


def test_additive_smoothing() -> None:
    np.random.seed(12345)
    x_index, y_index = np.random.rand(7), np.random.rand(7)
    counts = (
        pd.Series([0, 1, 2, 3, 0, 0, 0], name="x", index=x_index, dtype=int),
        pd.Series([0, 0, 0, 3, 2, 1, 0], name="y", index=y_index, dtype=int),
    )

    for i, (desired_result, actual_result) in enumerate(
        zip(
            (
                pd.Series(
                    [0.0769, 0.1538, 0.2308, 0.3077, 0.0769, 0.0769, 0.0769],
                    name="x",
                    index=x_index,
                    dtype=float,
                ),
                pd.Series(
                    [0.0769, 0.0769, 0.0769, 0.3077, 0.2308, 0.1538, 0.0769],
                    name="y",
                    index=y_index,
                    dtype=float,
                ),
            ),
            map(binning.AdditiveSmoothing(pseudocount=1), counts),
        )
    ):
        assert_almost_equal(actual_result.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual_result.round(4), desired_result)

    for i, (desired_result, actual_result) in enumerate(
        zip(
            (
                pd.Series(
                    [0.0149, 0.1642, 0.3134, 0.4627, 0.0149, 0.0149, 0.0149],
                    name="x",
                    index=x_index,
                    dtype=float,
                ),
                pd.Series(
                    [0.0149, 0.0149, 0.0149, 0.4627, 0.3134, 0.1642, 0.0149],
                    name="y",
                    index=y_index,
                    dtype=float,
                ),
            ),
            map(binning.AdditiveSmoothing(pseudocount=0.1), counts),
        )
    ):
        assert_almost_equal(actual_result.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual_result.round(4), desired_result)

    for i, (desired_result, actual_result) in enumerate(
        zip(
            (
                pd.Series(
                    [0, 0.1667, 0.3333, 0.5, 0, 0, 0],
                    name="x",
                    index=x_index,
                    dtype=float,
                ),
                pd.Series(
                    [0, 0, 0, 0.5, 0.3333, 0.1667, 0],
                    name="y",
                    index=y_index,
                    dtype=float,
                ),
            ),
            map(binning.AdditiveSmoothing(pseudocount=0), counts),
        )
    ):
        assert_almost_equal(actual_result.sum(), 1, err_msg=f"i={i}")
        assert_series_equal(actual_result.round(4), desired_result)


data = pd.Series([-1, 0, 1, 2, 3, None, ""], dtype=object)


def test_categorical_binning() -> None:
    assert_series_equal(
        binning.CategoricalBinning().histogram(data),
        data.value_counts(dropna=False),
    )
    assert_series_equal(
        binning.CategoricalBinning(dropna=True).histogram(data),
        data.value_counts(),
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
        binning.IntervalBinning(bins=bins).histogram(data),
        pd.cut(data, bins).value_counts(dropna=False),
    )
    assert_series_equal(
        binning.IntervalBinning(bins=bins, dropna=True).histogram(data),
        pd.cut(data, bins).value_counts(),
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
        binning.QuantileBinning(probabilities=prob).histogram(data),
        pd.cut(data, bins).value_counts(dropna=False),
    )
    assert_series_equal(
        binning.QuantileBinning(probabilities=prob, dropna=True).histogram(data),
        pd.cut(data, bins).value_counts(),
    )


def test_quantile_binning_reference_bins_adherence() -> None:
    method = binning.QuantileBinning(
        reference_series=data,
        probabilities=(0.25, 0.5, 0.75),
        dropna=True,
    )
    assert (bins := method.bins) is not None
    new_data = pd.Series(range(2001)) - 1000
    hist = method.histogram(new_data)
    diff = hist.index.difference(bins)
    assert hist.sum() == len(new_data)
    assert diff.empty


@pytest.mark.parametrize("dropna", [(True,), (False,)])
def test_quantile_binning_dropna_adherence(dropna: bool) -> None:
    method = binning.QuantileBinning(
        reference_series=data,
        probabilities=(0.25, 0.5, 0.75),
        dropna=dropna,
    )
    new_data = pd.Series([None])
    hist = method.histogram(new_data)
    diff = hist.index.difference(method.bins)
    if dropna:
        assert hist.sum() == 0
        assert diff.empty
    else:
        assert hist.sum() == len(new_data)
        assert diff.size == 1
        assert math.isnan(diff[0])


@pytest.mark.parametrize(
    "metrics,desired_values,dropna",
    [
        ((), [], False),
        ((), [], True),
        ((Count(),), [[12, 5, 1]], False),
        ((Count(),), [[5, 1]], True),
        ((CountNotNull(Column("x")),), [[6, 4, 0]], False),
        ((CountNotNull(Column("x")),), [[4, 0]], True),
        ((CountNotNull(Column()),), [[0] * 3], False),
        ((CountNotNull(Column()),), [[0] * 2], True),
        (
            (
                Max(Column("x")),
                Max(Column()),
                Max(Column("x2")),
                Max(Column("x")),
            ),
            [
                [7.0, 6.0, float("nan")],
                [float("nan")] * 3,
                [14.0, 12.0, float("nan")],
                [7.0, 6.0, float("nan")],
            ],
            False,
        ),
        (
            (
                Max(Column("x2")),
                Max(Column()),
                Max(Column("x")),
                Max(Column("x2")),
            ),
            [
                [12.0, float("nan")],
                [float("nan")] * 2,
                [6.0, float("nan")],
                [12.0, float("nan")],
            ],
            True,
        ),
    ],
)
def test_segmented_summary_with_interval_binning(
    metrics: Tuple[Metric],
    desired_values: List[List[Any]],
    dropna: bool,
) -> None:
    df = pd.DataFrame(
        [
            [float("nan"), float("nan")],
            [None, -1],
            [pd.NA, float("-inf")],  # infinities are not null
            [pd.NaT, float("nan")],
            [MISSING, float("nan")],  # MISSING is not null
            [-4, 5],
            [-3, float("nan")],
            [-2, 1],
            [0.1, 0],
            [1, 4],
            [" 1 ", 6],  # " 1 " is same as 1 due to numeric coercion
            [1.1, float("nan")],
            [2, 2],
            [" 2 ", 3],
            ["", float("nan")],  # "" is same as NaN due to numeric coercion
            ["nan", float("nan")],
            [float("inf"), 7],
            [float("-inf"), float("nan")],
        ],
        columns=["by", "x"],
    )
    df["x2"] = df["x"] * 2
    df["x3"] = df["x"] * 3  # should not be summarized
    bins = pd.IntervalIndex(
        (
            pd.Interval(-2, 2, closed="left"),
            pd.Interval(100, 200, closed="left"),  # not found in data
            pd.Interval(float("-inf"), -200, closed="left"),
        ),
    )
    binning_method = binning.IntervalBinning(
        bins=bins,
        dropna=dropna,
    )
    actual = binning_method.segmented_summary(
        Column("by"),
        df.sample(len(df)),
        metrics,
    )
    desired = pd.DataFrame(
        dict(zip((m.id() for m in metrics), desired_values)),
    ).set_axis(
        pd.CategoricalIndex(
            cast(List[Any], [] if dropna else [float("nan")])
            + [
                pd.Interval(-2, 2, closed="left"),
                pd.Interval(float("-inf"), -200, closed="left"),
            ],
            categories=bins,
            ordered=True,
        ),
        axis=0,
        copy=False,
    )
    _compare_summaries(metrics, actual, desired)


@pytest.mark.parametrize(
    "metrics,desired_values,dropna",
    [
        ((), [], False),
        ((), [], True),
        ((Count(),), [[4, 1, 2, 3, 1, 4, 1, 1]], False),
        ((Count(),), [[1, 2, 3, 1, 4, 1, 1]], True),
        ((CountNotNull(Column("x")),), [[4, 1, 2, 2, 0, 3, 0, 1]], False),
        ((CountNotNull(Column("x")),), [[1, 2, 2, 0, 3, 0, 1]], True),
        ((CountNotNull(Column()),), [[0] * 8], False),
        ((CountNotNull(Column()),), [[0] * 7], True),
        (
            (
                Max(Column("x")),
                Max(Column()),
                Max(Column("x2")),
                Max(Column("x")),
            ),
            [
                [-2, -1, 0, 1, float("nan"), 2, float("nan"), 3],
                [float("nan")] * 8,
                [-4, -2, 0, 2, float("nan"), 4, float("nan"), 6],
                [-2, -1, 0, 1, float("nan"), 2, float("nan"), 3],
            ],
            False,
        ),
        (
            (
                Max(Column("x2")),
                Max(Column()),
                Max(Column("x")),
                Max(Column("x2")),
            ),
            [
                [-2, 0, 2, float("nan"), 4, float("nan"), 6],
                [float("nan")] * 7,
                [-1, 0, 1, float("nan"), 2, float("nan"), 3],
                [-2, 0, 2, float("nan"), 4, float("nan"), 6],
            ],
            True,
        ),
    ],
)
def test_segmented_summary_with_categorical_binning(
    metrics: Tuple[Metric],
    desired_values: List[List[Any]],
    dropna: bool,
) -> None:
    df = pd.DataFrame(
        [
            [float("nan"), -2],
            [pd.NA, -3],
            [pd.NaT, -4],
            [None, -5],
            [MISSING, -1],  # MISSING is not null
            [0.1, 0],
            [0.1, 0],
            [1, 1],
            [1, 1],
            [1, float("nan")],
            ["", float("nan")],
            ["1", 2],  # "1" differs from 1
            ["1", float("-inf")],  # infinities are not null
            ["1", 2],
            ["1", float("nan")],
            ["nan", float("nan")],
            [float("-inf"), 3],
        ],
        columns=["by", "x"],
    )
    df["x2"] = df["x"] * 2
    df["x3"] = df["x"] * 3  # should not be summarized
    binning_method = binning.CategoricalBinning(
        dropna=dropna,
    )
    actual = binning_method.segmented_summary(
        Column("by"),
        df.sample(len(df)),
        metrics,
    )
    desired = pd.DataFrame(
        dict(zip((m.id() for m in metrics), desired_values)),
    ).set_axis(
        pd.CategoricalIndex(
            cast(List[Any], [] if dropna else [float("nan")])
            + [MISSING, 0.1, 1, "", "1", "nan", float("-inf")],
            ordered=False,
        ),
        axis=0,
        copy=False,
    )
    _compare_summaries(metrics, actual, desired)


def _compare_summaries(
    metrics: Tuple[Metric],
    actual: pd.DataFrame,
    desired: pd.DataFrame,
) -> None:
    assert_almost_equal(len(actual), len(desired))
    assert_almost_equal(actual.size, desired.size)
    for idx in desired.index.union(actual.index):
        results = []
        for summary in (actual, desired):
            try:
                results.append(summary.loc[idx])
            except KeyError:
                results.append({})
        for metric in metrics:
            assert_almost_equal(
                *map(metric.get_value, results),
                err_msg=f"{repr(idx)}:{repr(metric)}",
            )
