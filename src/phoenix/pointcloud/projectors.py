import warnings
from dataclasses import asdict, dataclass
from typing import cast

import numpy as np
import numpy.typing as npt
from typing_extensions import TypeAlias

with warnings.catch_warnings():
    from numba.core.errors import NumbaWarning

    warnings.simplefilter("ignore", category=NumbaWarning)
    from umap import UMAP
Matrix: TypeAlias = npt.NDArray[np.float64]


def _center(arr: Matrix) -> Matrix:
    return cast(Matrix, arr - np.mean(arr, axis=0))


@dataclass(frozen=True)
class Umap:
    n_neighbors: int = 15
    min_dist: float = 0.1

    def project(self, mat: Matrix, n_components: int) -> Matrix:
        return _center(UMAP(**asdict(self), n_components=n_components).fit_transform(mat))
