import warnings
from dataclasses import asdict, dataclass
from typing import cast

import numpy as np
import numpy.typing as npt
from numba.core.errors import NumbaDeprecationWarning, NumbaPendingDeprecationWarning
from typing_extensions import TypeAlias

Matrix: TypeAlias = npt.NDArray[np.float64]


def _center(arr: Matrix) -> Matrix:
    return cast(Matrix, arr - np.mean(arr, axis=0))


@dataclass(frozen=True)
class Umap:
    n_neighbors: int = 15
    min_dist: float = 0.1

    def project(self, mat: Matrix, n_components: int) -> Matrix:
        warnings.simplefilter("ignore", category=NumbaDeprecationWarning)
        warnings.simplefilter("ignore", category=NumbaPendingDeprecationWarning)
        from umap import UMAP

        return _center(UMAP(**asdict(self), n_components=n_components).fit_transform(mat))
