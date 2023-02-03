from typing import cast

import numpy as np
import numpy.typing as npt
from scipy.spatial.distance import euclidean  # type: ignore


def euclidean_distance(
    array0: npt.NDArray[np.float64],
    array1: npt.NDArray[np.float64],
) -> float:
    """
    Computes Euclidean distance between the centroids of two arrays.
    """
    return cast(float, euclidean(np.mean(array0, axis=0), np.mean(array1, axis=0)))
