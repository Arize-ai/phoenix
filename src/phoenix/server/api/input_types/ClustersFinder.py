from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.pointcloud import clusters
from phoenix.pointcloud.clusters import Hdbscan, Kmeans

from . import Config, OneOf


@strawberry.input
class HdbscanConfig(Config[Hdbscan]):
    """Hierarchical Density-Based Spatial Clustering of Applications with Noise"""

    min_cluster_size: Optional[int] = strawberry.field(
        description="minimum cluster size",
        default=10,
    )
    min_samples: Optional[int] = strawberry.field(
        description="minimum samples",
        default=1,
    )
    cluster_selection_epsilon: Optional[float] = strawberry.field(
        description="cluster selection epsilon",
        default=0.0,
    )

    def __call__(self) -> Hdbscan:
        return Hdbscan(**self)


@strawberry.input
class KmeansConfig(Config[Kmeans]):
    """K-Means clustering"""

    n_clusters: Optional[int] = strawberry.field(
        description="number of clusters to form",
        default=8,
    )

    def __call__(self) -> Kmeans:
        return Kmeans(**self)


@strawberry.input
class ClustersFinder(OneOf[clusters.Finder]):
    hdbscan: Optional[HdbscanConfig] = UNSET
    kmeans: Optional[KmeansConfig] = UNSET
