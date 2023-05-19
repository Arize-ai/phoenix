from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Set

import numpy as np
import numpy.typing as npt
from hdbscan import HDBSCAN
from sklearn.cluster import KMeans
from typing_extensions import TypeAlias

from phoenix.pointcloud import Parameters

RowIndex: TypeAlias = int
RowCluster: TypeAlias = Set[RowIndex]
Matrix: TypeAlias = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Finder(ABC):
    @abstractmethod
    def find_clusters(self, mat: Matrix) -> List[RowCluster]:
        ...


@dataclass(frozen=True)
class Hdbscan(Finder, Parameters):
    """Hierarchical Density-Based Spatial Clustering of Applications with Noise"""

    min_cluster_size: Optional[int] = 10
    min_samples: Optional[float] = 1
    cluster_selection_epsilon: Optional[float] = 0.0

    def find_clusters(self, mat: Matrix) -> List[RowCluster]:
        cluster_ids: npt.NDArray[np.int_] = HDBSCAN(**self).fit_predict(mat)
        ans: List[RowCluster] = [set() for _ in range(np.max(cluster_ids) + 1)]
        for row_idx, cluster_id in enumerate(cluster_ids):
            if cluster_id > -1:
                ans[cluster_id].add(row_idx)
        return ans


@dataclass(frozen=True)
class Kmeans(Finder, Parameters):
    """K-Means Clustering"""

    n_clusters: Optional[int] = 8

    def find_clusters(self, mat: Matrix) -> List[RowCluster]:
        cluster_ids: npt.NDArray[np.int_] = KMeans(**self).fit_predict(mat)
        ans: List[RowCluster] = [set() for _ in range(np.max(cluster_ids) + 1)]
        for row_idx, cluster_id in enumerate(cluster_ids):
            if cluster_id > -1:
                ans[cluster_id].add(row_idx)
        return ans
