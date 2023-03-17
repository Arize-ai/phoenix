from typing import Optional, cast

import numpy as np
import numpy.typing as npt
from scipy.spatial.distance import euclidean


def euclidean_distance(
    pt0: npt.NDArray[np.float64],
    pt1: npt.NDArray[np.float64],
) -> Optional[float]:
    """
    Computes Euclidean distance between two points.
    """
    return cast(float, euclidean(pt0, pt1))
