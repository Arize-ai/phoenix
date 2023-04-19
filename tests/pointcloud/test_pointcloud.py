from dataclasses import dataclass
from itertools import cycle
from typing import Dict, List, Set

import numpy as np
import numpy.typing as npt
import pytest
from phoenix.core.model_schema import EventId
from phoenix.pointcloud.pointcloud import PointCloud


@dataclass
class MockDimensionalityReducer:
    samp_size: int

    def project(self, _: npt.NDArray[np.float64], n_components: int) -> npt.NDArray[np.float64]:
        return np.random.rand(self.samp_size, n_components)


@dataclass
class MockClustersFinder:
    cluster_assignments: Dict[int, int]

    def find_clusters(self, arr: npt.NDArray[np.float64]) -> List[Set[int]]:
        ans: List[Set[int]] = [set() for _ in range(len(set(self.cluster_assignments.values())))]
        for i in range(arr.shape[0]):
            ans[self.cluster_assignments[i]].add(i)
        return ans


@pytest.mark.parametrize(
    "samp_size,n_features,n_components,n_clusters", [(10, 20, 5, 3), (20, 30, 7, 5)]
)
def test_point_cloud(samp_size: int, n_features: int, n_components: int, n_clusters: int) -> None:
    cluster_assignments = dict(zip(range(samp_size), cycle(range(n_clusters))))

    data = {EventId(row_id=i): np.random.rand(1, n_features) for i in range(samp_size)}

    points, clusters = PointCloud(
        dimensionalityReducer=(MockDimensionalityReducer(samp_size)),
        clustersFinder=(MockClustersFinder(cluster_assignments)),
    ).generate(
        data,
        n_components,
    )

    assert np.stack(points.values()).shape == (samp_size, n_components)
    assert len(set(clusters.values())) == n_clusters
    assert set(points.keys()) == set(data.keys())
    assert set(clusters.keys()) <= set(data.keys())
