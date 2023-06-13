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
        config = asdict(self)
        config["n_components"] = n_components
        if len(mat) <= n_components:
            # init='spectral', the default, cannot be used when n_components
            # is greater or equal to the number of samples.
            # see https://github.com/lmcinnes/umap/issues/201#issuecomment-462097103
            config["init"] = "random"
        return _center(UMAP(**config).fit_transform(mat))
