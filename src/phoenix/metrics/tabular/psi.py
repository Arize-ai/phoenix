"""
Methods to calculate the population stability index (PSI) between two datasets.
"""

import numpy as np

from phoenix.datasets import Dataset
from phoenix.metrics.tabular.binning import BinningStrategy


def psi(
    primary: Dataset,
    reference: Dataset,
    binning_strategy: BinningStrategy,
    embedding_column_name: str,
    epsilon: float = 1e-7,
) -> np.array:
    """
    Calculates the population stability index (PSI) between two datasets.

    :param Dataset primary: Primary dataset.
    :param Dataset reference: Reference dataset.
    :param BinningStrategy binning_strategy: Binning strategy.
    :param str embedding_column_name: Column name to use to compute distance between distributions.
    :param float epsilon: Floating point value to prevent division by zero. Defaults to 1e-7.
    :return: Example
    """

    raise NotImplementedError()
    # primary_histogram, reference_histogram = binning_strategy.bin(primary, reference)
    # primary_percentages = primary_histogram / primary_histogram.sum()
    # reference_percentages = reference_histogram / reference_histogram.sum()
    # return _psi(primary_percentages, reference_percentages, epsilon)


def _psi(p: np.ndarray, q: np.ndarray, epsilon: float) -> np.ndarray:
    return np.sum((p - q) * np.log(p / np.maximum(q, epsilon)), axis=1)
