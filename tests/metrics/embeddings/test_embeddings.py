"""
Test Euclidean distance for embeddings.
"""

import numpy as np
import pandas as pd
import pytest

from phoenix.datasets import Dataset, EmbeddingColumnNames, Schema
from phoenix.metrics.embeddings import euclidean_distance


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


def test_happy_path_same_schema(primary_embeddings, reference_embeddings):
    # Arrange.
    num_samples = len(primary_embeddings)
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=[
            "primary_feature1",
            "primary_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=[
            "reference_feature1",
            "reference_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
        },
    )
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [f"primary-prediction-id-{i}" for i in range(num_samples)],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "embedding_vector": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [f"reference-prediction-id-{i}" for i in range(num_samples)],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "embedding_vector": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema, name="primary")
    reference = Dataset(reference_df, reference_schema, name="reference")
    primary_centroid = np.mean(
        np.stack(primary_embeddings, axis=0),
        axis=0,
    )
    reference_centroid = np.mean(
        np.stack(reference_embeddings, axis=0),
        axis=0,
    )
    expected_distance = np.linalg.norm(primary_centroid - reference_centroid)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding_feature")

    # Assert.
    np.testing.assert_array_almost_equal(distance, np.array(expected_distance))


def test_happy_path_different_schemas(primary_embeddings, reference_embeddings):
    # Arrange.
    num_samples = len(primary_embeddings)
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=[
            "primary_feature1",
            "primary_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="primary_embedding_vector")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=[
            "reference_feature1",
            "reference_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(
                vector_column_name="reference_embedding_vector"
            )
        },
    )
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [f"primary-prediction-id-{i}" for i in range(num_samples)],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "primary_embedding_vector": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [f"reference-prediction-id-{i}" for i in range(num_samples)],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "reference_embedding_vector": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema, name="primary")
    reference = Dataset(reference_df, reference_schema, name="reference")
    primary_centroid = np.mean(
        np.stack(primary_embeddings, axis=0),
        axis=0,
    )
    reference_centroid = np.mean(
        np.stack(reference_embeddings, axis=0),
        axis=0,
    )
    expected_distance = np.linalg.norm(primary_centroid - reference_centroid)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding_feature")

    # Assert.
    np.testing.assert_array_almost_equal(distance, np.array(expected_distance))


@pytest.mark.parametrize(
    "random_seed,num_samples,embedding_dimension",
    [(0, 2, 4), (0, 5, 10), (0, 10, 20)],
)
def test_random_array_values(random_seed, num_samples, embedding_dimension):
    # Arrange.
    primary_schema = Schema(
        prediction_id_column_name="primary_prediction_id",
        feature_column_names=[
            "primary_feature1",
            "primary_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="primary_embedding_vector")
        },
    )
    reference_schema = Schema(
        prediction_id_column_name="reference_prediction_id",
        feature_column_names=[
            "reference_feature1",
            "reference_feature2",
        ],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(
                vector_column_name="reference_embedding_vector"
            )
        },
    )
    np.random.seed(random_seed)
    primary_embeddings = [np.random.rand(embedding_dimension) for _ in range(num_samples)]
    reference_embeddings = [np.random.rand(embedding_dimension) for _ in range(num_samples)]
    primary_df = pd.DataFrame.from_dict(
        {
            "primary_prediction_id": [f"primary-prediction-id-{i}" for i in range(num_samples)],
            "primary_feature1": np.zeros(num_samples),
            "primary_feature2": np.zeros(num_samples),
            "primary_embedding_vector": primary_embeddings,
        }
    )
    reference_df = pd.DataFrame.from_dict(
        {
            "reference_prediction_id": [f"reference-prediction-id-{i}" for i in range(num_samples)],
            "reference_feature1": np.zeros(num_samples),
            "reference_feature2": np.zeros(num_samples),
            "reference_embedding_vector": reference_embeddings,
        }
    )
    primary = Dataset(primary_df, primary_schema, name="primary")
    reference = Dataset(reference_df, reference_schema, name="reference")
    primary_centroid = np.mean(
        np.stack(primary_embeddings, axis=0),
        axis=0,
    )
    reference_centroid = np.mean(
        np.stack(reference_embeddings, axis=0),
        axis=0,
    )
    expected_distance = np.linalg.norm(primary_centroid - reference_centroid)

    # Act.
    distance = euclidean_distance(primary, reference, "embedding_feature")

    # Assert.
    np.testing.assert_array_almost_equal(distance, expected_distance)
