import uuid
from dataclasses import dataclass
from functools import reduce
from itertools import cycle
from operator import or_

import numpy as np
import numpy.typing as npt
import pytest

from phoenix.pointcloud.pointcloud import PointCloud


@dataclass
class MockProjector:
    samp_size: int

    def project(self, _: npt.NDArray[np.float64], n_components: int) -> npt.NDArray[np.float64]:
        return np.random.rand(self.samp_size, n_components)


@dataclass
class MockClustersFinder:
    cluster_assignments: dict[int, int]

    def find_clusters(self, arr: npt.NDArray[np.float64]) -> list[set[int]]:
        ans: list[set[int]] = [set() for _ in range(len(set(self.cluster_assignments.values())))]
        for i in range(arr.shape[0]):
            ans[self.cluster_assignments[i]].add(i)
        return ans


@pytest.mark.parametrize(
    "samp_size,n_features,n_components,n_clusters", [(10, 20, 5, 3), (20, 30, 7, 5)]
)
def test_point_cloud(samp_size: int, n_features: int, n_components: int, n_clusters: int) -> None:

    cluster_assignments = dict(zip(range(samp_size), cycle(range(n_clusters))))

    projector = MockProjector(samp_size)
    clusters_finder = MockClustersFinder(cluster_assignments)
    data = {str(uuid.uuid4()): np.random.rand(1, n_features) for i in range(samp_size)}

    points, clusters = PointCloud(
        dimensionalityReducer=projector, clustersFinder=clusters_finder
    ).generate(
        data,
        n_components,
    )

    assert np.stack(points.values()).shape == (samp_size, n_components)
    assert len(clusters) == n_clusters
    assert set(points.keys()) == set(data.keys())
    assert reduce(or_, clusters) == set(data.keys())
