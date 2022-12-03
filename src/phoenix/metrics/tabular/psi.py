"""
Method to calculate the population stability index (PSI) between two datasets.
"""

import numpy as np

from phoenix.datasets import Dataset


def psi(
    primary: Dataset,
    reference: Dataset,
    embedding_feature_name: str,
    epsilon: float = 1e-7,
) -> float:
    pass


def _psi(
    distribution_p: np.ndarray, distribution_q: np.ndarray, epsilon: float
) -> np.ndarray[float]:
    return np.sum(
        (distribution_p - distribution_q)
        * np.log(distribution_p / np.maximum(distribution_q, epsilon)),
        axis=1,
    )
