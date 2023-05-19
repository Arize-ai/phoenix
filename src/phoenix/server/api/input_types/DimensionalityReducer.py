from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.pointcloud import dimensionality
from phoenix.pointcloud.dimensionality import Tsne, Umap

from . import Config, OneOf


@strawberry.input
class UmapConfig(Config[Umap]):
    """Uniform Manifold Approximation and Projection for Dimension Reduction

    https://umap-learn.readthedocs.io/en/latest/
    """

    n_components: Optional[int] = strawberry.field(
        description="Dimension of the reduced space. Must be 2 or 3",
        default=3,
    )
    min_dist: Optional[int] = strawberry.field(
        description="Minimum distance: "
        "https://umap-learn.readthedocs.io/en/latest/parameters.html#min-dist",
        default=0,
    )
    n_neighbors: Optional[int] = strawberry.field(
        description="N neighbors: "
        "https://umap-learn.readthedocs.io/en/latest/parameters.html#n-neighbors",
        default=30,
    )

    def __post_init__(self) -> None:
        # validate n_components to be 2 or 3 (if not None)
        if self.n_components is not None and not (2 <= self.n_components <= 3):
            raise ValueError(f"n_components must be 2 or 3, but got {self.n_components}")

    def __call__(self) -> Umap:
        return Umap(**self)


@strawberry.input
class TsneConfig(Config[Tsne]):
    """T-distributed Stochastic Neighbor Embedding

    https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html#sklearn.manifold.TSNE
    """

    n_components: Optional[int] = strawberry.field(
        description="Dimension of the reduced space. Must be 2 or 3",
        default=3,
    )
    perplexity: Optional[int] = strawberry.field(
        description="TBD",
        default=30,
    )

    def __call__(self) -> Tsne:
        return Tsne(**self)


@strawberry.input
class DimensionalityReducer(OneOf[dimensionality.Reducer]):
    umap: Optional[UmapConfig] = strawberry.field(
        description="Uniform Manifold Approximation and Projection for Dimension Reduction: "
        "https://umap-learn.readthedocs.io/en/latest/",
        default=UNSET,
    )
    tsne: Optional[TsneConfig] = strawberry.field(
        description="T-distributed Stochastic Neighbor Embedding: "
        "https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html#sklearn.manifold.TSNE",
        default=UNSET,
    )
