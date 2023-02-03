import numpy as np
import numpy.typing as npt


def euclidean_distance(
    array0: npt.NDArray[np.float64],
    array1: npt.NDArray[np.float64],
) -> float:
    """
    Computes Euclidean distance between the centroids of two arrays.
    """
    return np.linalg.norm(np.mean(array0, axis=0) - np.mean(array1, axis=0)).tolist()
