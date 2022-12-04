"""
Method to calculate the population stability index (PSI) between two datasets.
"""

from typing import List

import numpy as np
import numpy.typing as npt

from phoenix.datasets import Dataset


def psi(
    primary: Dataset,
    reference: Dataset,
    embedding_column_names: List[str],
    epsilon: float = 1e-7,
) -> npt.NDArray[np.float64]:
    raise NotImplementedError()


def _psi(
    distribution_p: np.ndarray, distribution_q: np.ndarray, epsilon: float
) -> npt.NDArray[np.float64]:
    return np.sum(
        (distribution_p - distribution_q)
        * np.log(distribution_p / np.maximum(distribution_q, epsilon)),
        axis=1,
    )
