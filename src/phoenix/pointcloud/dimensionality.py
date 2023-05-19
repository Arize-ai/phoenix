from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, cast

import numpy as np
import numpy.typing as npt
from sklearn.manifold import TSNE
from typing_extensions import TypeAlias
from umap import UMAP

from phoenix.pointcloud import Parameters

Matrix: TypeAlias = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Reducer(ABC):
    n_components: Optional[int] = 3
    """Dimension of the reduced space"""

    @abstractmethod
    def reduce_dimensionality(self, mat: Matrix) -> Matrix:
        ...


@dataclass(frozen=True)
class Umap(Reducer, Parameters):
    """Uniform Manifold Approximation and Projection for Dimension Reduction

    https://umap-learn.readthedocs.io/en/latest/
    """

    n_neighbors: Optional[int] = 15
    min_dist: Optional[float] = 0.1

    def reduce_dimensionality(self, mat: Matrix) -> Matrix:
        return _center(UMAP(**self).fit_transform(mat))


@dataclass(frozen=True)
class Tsne(Reducer, Parameters):
    """T-distributed Stochastic Neighbor Embedding

    https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html#sklearn.manifold.TSNE
    """

    perplexity: Optional[int] = 30

    def reduce_dimensionality(self, mat: Matrix) -> Matrix:
        return _center(TSNE(**self).fit_transform(mat))


def _center(arr: Matrix) -> Matrix:
    return cast(
        Matrix,
        arr - np.mean(arr, axis=0),
    )
