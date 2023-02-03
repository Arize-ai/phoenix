import numpy as np
from numpy.testing import assert_approx_equal

from phoenix.metrics.embeddings import euclidean_distance


def test_euclidean_distance_with_full_embeddings():
    array0 = np.array([[0.0, 0.0], [1.0, -1.0], [-1.0, 1.0]])  # Mean at (0, 0)
    array1 = np.array([[3.0, 4.0], [2.0, 5.0], [4.0, 3.0]])  # Mean at (3, 4)
    dist = euclidean_distance(array0, array1)
    assert_approx_equal(dist, 5.0)
