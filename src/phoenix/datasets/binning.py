"""
Methods for binning and creating histograms.
"""

import concurrent.futures as cf
from typing import Optional

import numpy as np
import numpy.typing as npt
import pandas as pd


def compute_default_bins(df: pd.DataFrame, max_workers: Optional[int] = None) -> pd.DataFrame:
    """
    Takes a DataFrame of numerical values and returns a DataFrame of bin boundaries.
    """

    stats = _compute_median_and_standard_deviation(df, max_workers=max_workers)
    return stats.apply(_compute_default_bins_from_stats_column)


def compute_histogram(
    df: pd.DataFrame, bins_df: pd.DataFrame, max_workers: Optional[int] = None
) -> pd.DataFrame:
    """
    Computes histogram of raw counts.
    """
    num_bins = bins_df.shape[0] + 1
    histogram_df = pd.DataFrame(columns=df.columns, index=np.arange(num_bins))
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name = {
            executor.submit(
                _compute_histogram_for_column_using_bins,
                df[col],
                interior_bin_boundaries=bins_df[col].to_numpy(),
            ): col
            for col in df.columns
        }
        for future in cf.as_completed(future_to_column_name):
            column = future_to_column_name[future]
            histogram = future.result()
            histogram_df[column] = histogram
    return histogram_df


def _compute_median_and_standard_deviation(
    df: pd.DataFrame, max_workers: Optional[int] = None
) -> pd.DataFrame:
    stats_df = pd.DataFrame(index=["median", "standard_deviation"])
    with cf.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_column_name = {
            executor.submit(
                lambda col: (np.median(col), np.std(col)),
                df[column],
            ): column
            for column in df.columns
        }
        for future in cf.as_completed(future_to_column_name):
            column = future_to_column_name[future]
            stats_df[column] = list(future.result())
    return stats_df


def _compute_default_bins_from_stats_column(stats_column: "pd.Series[float]") -> "pd.Series[float]":
    bin_boundaries = (
        np.linspace(-4 / 3, 4 / 3, 9) * stats_column["standard_deviation"] + stats_column["median"]
    )
    bins_column: "pd.Series[float]" = pd.Series(bin_boundaries)
    return bins_column


def _compute_histogram_for_column_using_bins(
    array: npt.NDArray[np.float64], interior_bin_boundaries: npt.NDArray[np.float64]
) -> npt.NDArray[np.float64]:
    bin_indexes = np.searchsorted(interior_bin_boundaries, array)
    histogram = np.bincount(bin_indexes)
    pad_width = interior_bin_boundaries.shape[0] - histogram.shape[0] + 1
    histogram = np.pad(histogram, (0, pad_width))
    return histogram
