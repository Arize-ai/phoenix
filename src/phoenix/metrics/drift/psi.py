"""
Method to calculate the population stability index (PSI) between two datasets.
"""

import numpy as np
import pandas as pd


def psi(
    primary_distribution: pd.DataFrame, reference_distribution: pd.DataFrame, epsilon: float = 1e-7
) -> pd.Series:
    """
    Computes Population Stability Index (PSI) between distributions.
    """
    return (
        (primary_distribution - reference_distribution)
        * np.log(primary_distribution / np.maximum(reference_distribution, epsilon))
    ).sum(axis=1)
