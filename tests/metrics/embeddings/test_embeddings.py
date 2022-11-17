"""
Test embeddings.
"""

import math

import numpy as np
import pandas as pd
import pytest

from arize_toolbox.datasets import Dataset
from arize_toolbox.datasets.types import EmbeddingColumnNames, Schema
from arize_toolbox.metrics.embeddings import euclidean_distance


@pytest.fixture
def primary_embeddings():
    return [
        np.array([1.1, -2.2, 3.3, 4.4]),
        np.array([-0.1, 1.0, 340.0, -103.6]),
        np.array([-0.1, 1.0, 340.0, -103.6]),
    ]


@pytest.fixture
def reference_embeddings():
    return [
        np.array([12.0, -12.1, 2.9, 3.1]),
        np.array([-711.0, 9.2, -32.2, 13.6]),
        np.array([1.5, 90.0, 42.9, -13.6]),
    ]


def test_happy_path(primary_embeddings, reference_embeddings):
    # Arrange.
    num_samples = 3
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=["primary_feature1", "primary_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="embedding")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=["reference_feature1", "reference_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="embedding")
        },
    )
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [
                f"primary-prediction-id-{i}" for i in range(num_samples)
            ],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "embedding": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [
                f"reference-prediction-id-{i}" for i in range(num_samples)
            ],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "embedding": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema)
    reference = Dataset(reference_df, reference_schema)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding")

    # Assert.
    np.testing.assert_array_almost_equal(distance, np.array(331.03822370770956))


def test_differing_column_names(primary_embeddings, reference_embeddings):
    # Arrange.
    num_samples = 3
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=["primary_feature1", "primary_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="primary_embedding")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=["reference_feature1", "reference_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="reference_embedding")
        },
    )
    num_samples = len(primary_embeddings)
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [
                f"primary-prediction-id-{i}" for i in range(num_samples)
            ],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "primary_embedding": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [
                f"reference-prediction-id-{i}" for i in range(num_samples)
            ],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "reference_embedding": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema)
    reference = Dataset(reference_df, reference_schema)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding")

    # Assert.
    np.testing.assert_array_almost_equal(distance, np.array(331.03822370770956))


@pytest.mark.parametrize(
    "random_seed,num_samples,embedding_dimension", [(0, 2, 4), (0, 5, 10), (0, 10, 20)]
)
def test_random_array_values(random_seed, num_samples, embedding_dimension):
    # Arrange.
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=["primary_feature1", "primary_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="primary_embedding")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=["reference_feature1", "reference_feature2"],
        embedding_feature_column_names={
            "embedding": EmbeddingColumnNames(vector_column_name="reference_embedding")
        },
    )
    np.random.seed(random_seed)
    primary_embeddings = [np.random.rand(num_samples) for _ in range(num_samples)]
    reference_embeddings = [np.random.rand(num_samples) for _ in range(num_samples)]
    num_samples = len(primary_embeddings)
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [
                f"primary-prediction-id-{i}" for i in range(num_samples)
            ],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "primary_embedding": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [
                f"reference-prediction-id-{i}" for i in range(num_samples)
            ],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "reference_embedding": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema)
    reference = Dataset(reference_df, reference_schema)
    primary_centroid = compute_centroid(primary_embeddings)
    reference_centroid = compute_centroid(reference_embeddings)
    expected_distance = compute_euclidean_distance(primary_centroid, reference_centroid)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding")

    # Assert.
    np.testing.assert_array_almost_equal(distance, expected_distance)


def compute_centroid(points):
    num_dimensions = points[0].shape[0]
    centroid = []
    for dim in range(num_dimensions):
        sum_ = 0
        for point in points:
            sum_ += point[dim]
        centroid.append(float(sum_ / num_dimensions))
    return centroid


def compute_euclidean_distance(point_a, point_b):
    sum_of_squares = 0
    for val_a, val_b in zip(point_a, point_b):
        sum_of_squares += pow(val_a - val_b, 2)
    return math.sqrt(sum_of_squares)
