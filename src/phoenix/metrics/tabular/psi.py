"""
Method to calculate the population stability index (PSI) between two datasets.
"""

import numpy as np


def _psi(p: np.ndarray, q: np.ndarray, epsilon: float) -> np.ndarray:
    return np.sum((p - q) * np.log(p / np.maximum(q, epsilon)), axis=1)
