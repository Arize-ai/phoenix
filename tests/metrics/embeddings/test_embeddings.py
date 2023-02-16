import numpy as np
from numpy.testing import assert_approx_equal

from phoenix.metrics.embeddings import euclidean_distance


def test_euclidean_distance_agrees_with_simple_geometric_example() -> None:
    dist = euclidean_distance(np.array([0.0, 0.0]), np.array([3.0, 4.0]))
    assert_approx_equal(actual=dist, desired=5.0)


def test_euclidean_distance_between_the_same_point_is_zero() -> None:
    dist = euclidean_distance(np.array([4.0, 5.0]), np.array([4.0, 5.0]))
    assert_approx_equal(actual=dist, desired=0.0)
