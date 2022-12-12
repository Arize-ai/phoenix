"""
Methods for binning and creating histograms.
"""

from functools import partial
from typing import Any

import numpy as np
import pandas as pd


def compute_default_bins(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame of numerical values and returns a DataFrame of bin boundaries.
    """

    def compute_default_bins_from_stats(stats_column: pd.Series[Any]) -> pd.Series[Any]:
        bin_boundaries = np.concatenate(
            [
                np.array([-np.inf]),
                np.linspace(-4 / 3, 4 / 3, 9) * stats_column["std"] + stats_column["median"],
                np.array([np.inf]),
            ]
        )
        return pd.Series(bin_boundaries)

    stats = df.agg([np.median, np.std])
    return stats.apply(compute_default_bins_from_stats)


def compute_histogram(df: pd.DataFrame, bins_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes histogram of raw counts.
    """
    column_name_to_func_map = {}
    for column_name in df.columns:
        column_name_to_func_map[column_name] = partial(
            _compute_histogram_for_column_using_bins,
            bins=pd.IntervalIndex.from_breaks(bins_df[column_name]),
        )
    return df.agg(column_name_to_func_map)


def _compute_histogram_for_column_using_bins(
    column: pd.Series[Any], bins: pd.IntervalIndex
) -> pd.Series[Any]:
    histogram = column.value_counts(sort=False, bins=bins)  # type: ignore
    histogram = histogram[bins]
    histogram = histogram.set_axis(np.arange(histogram.shape[0]))
    return histogram
