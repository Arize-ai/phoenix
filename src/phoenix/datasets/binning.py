"""
Methods for binning and creating histograms.
"""

from functools import partial

import numpy as np
import numpy.typing as npt
import pandas as pd


def compute_default_bins(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame of numerical values and returns a DataFrame of bin boundaries.
    """

    def compute_default_bins_from_stats(stats_column: "pd.Series[float]") -> "pd.Series[float]":
        bin_boundaries = (
            np.linspace(-4 / 3, 4 / 3, 9) * stats_column["std"] + stats_column["median"]
        )
        bins_column: "pd.Series[float]" = pd.Series(bin_boundaries)
        return bins_column

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
            interior_bin_boundaries=bins_df[column_name].to_numpy(),
        )
    return df.agg(column_name_to_func_map)


def _compute_histogram_for_column_using_bins(
    array: npt.NDArray[np.float64], interior_bin_boundaries: npt.NDArray[np.float64]
) -> "pd.Series[float]":
    bin_indexes = np.searchsorted(interior_bin_boundaries, array)
    histogram = np.bincount(bin_indexes)
    pad_width = interior_bin_boundaries.shape[0] - histogram.shape[0] + 1
    histogram = np.pad(histogram, (0, pad_width))
    return pd.Series(histogram)
