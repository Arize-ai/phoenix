import numpy as np
import pytest

from phoenix.pointcloud.projectors import Umap


@pytest.mark.parametrize("samp_size,n_features,n_components", [(10, 8, 5), (15, 7, 3)])
def test_umap(samp_size: int, n_features: int, n_components: int) -> None:
    a = np.random.rand(n_features, n_features)
    projections = Umap().project(
        np.random.default_rng().multivariate_normal(
            np.random.rand(n_features), np.dot(a, a.T), samp_size
        ),
        n_components,
    )
    assert projections.shape == (samp_size, n_components)
    assert abs(projections.mean()) < 1e-5  # is centered
