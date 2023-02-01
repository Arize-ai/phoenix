from dataclasses import asdict, dataclass
from typing import cast

import numpy as np
import numpy.typing as npt
from umap import UMAP

DEFAULT_N_NEIGHBORS = 15
DEFAULT_MIN_DIST = 0.1


@dataclass(kw_only=True, frozen=True)
class Parameters:
    n_neighbors: int = DEFAULT_N_NEIGHBORS
    min_dist: float = DEFAULT_MIN_DIST


@dataclass(frozen=True)
class Umap:
    parameters: Parameters

    def _center(self, arr: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
        return cast(npt.NDArray[np.float64], arr - np.sum(arr, axis=0) / arr.shape[0])

    def project(self, data: npt.NDArray[np.float64], n_components: int) -> npt.NDArray[np.float64]:
        return self._center(
            UMAP(**asdict(self.parameters), n_components=n_components).fit_transform(data)
        )
