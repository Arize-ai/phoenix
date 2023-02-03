from functools import reduce
from operator import or_

import numpy as np
import pytest

from phoenix.pointcloud.clustering import Hdbscan


@pytest.mark.parametrize("samp_size,n_features,n_clusters", [(128, 2, 4), (256, 4, 8)])
def test_hdbscan(samp_size: int, n_features: int, n_clusters: int) -> None:
    a = np.random.rand(n_features, n_features)
    output = Hdbscan().find_clusters(
        np.concatenate(
            [
                np.random.default_rng().multivariate_normal(
                    np.random.rand(n_features) * 1_000_000, np.dot(a, a.T), samp_size
                )
                for _ in range(n_clusters)
            ]
        )
    )
    assert len(output) == n_clusters
    assert len(reduce(or_, output)) == samp_size * n_clusters
