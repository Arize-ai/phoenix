"""
Method to calculate the population stability index (PSI) between two datasets.
"""

import numpy as np
import pandas as pd

from phoenix.datasets import Dataset, BinningStrategy


def psi(
    primary: Dataset,
    reference: Dataset,
    binning_strategy: BinningStrategy,
    epsilon: float = 1e-7,
) -> pd.Series:
    primary_feature_columns = primary.get_feature_columns()
    reference_feature_columns = reference.get_feature_columns()
    primary_histogram, reference_histogram = binning_strategy.bin(primary_feature_columns, reference_feature_columns)
    primary_distributions = primary_histogram / primary_histogram.sum()
    reference_distributions = reference_histogram / reference_histogram.sum()
    return _psi(primary_distributions, reference_distributions, epsilon)


def _psi(
    primary_distribution: pd.DataFrame, reference_distribution: pd.DataFrame, epsilon: float
) -> pd.Series:
    return ((primary_distribution - reference_distribution)
        * np.log(primary_distribution / np.maximum(reference_distribution, epsilon))).sum(axis=0)
