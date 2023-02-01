import numpy as np
import pytest
from pointcloud.projectors import Parameters, Umap


@pytest.mark.parametrize("samp_size,n_features,n_components", [(10, 8, 5), (15, 7, 3)])
def test_umap(samp_size: int, n_features: int, n_components: int) -> None:
    a = np.random.rand(n_features, n_features)
    x = np.random.default_rng().multivariate_normal(
        np.random.rand(n_features), np.dot(a, a.T), samp_size
    )
    output = Umap(Parameters()).project(x, n_components)
    assert output.shape == (samp_size, n_components)
    assert abs(output.mean()) < 1e-5  # is centered
