"""
Euclidean distance for embeddings.
"""

import numpy as np
import pandas as pd

from phoenix.datasets import Dataset


def euclidean_distance(
    primary: Dataset,
    reference: Dataset,
    embedding_feature_name: str,
) -> np.ndarray:
    """
    It computes the Euclidean distance between the centroids of the embedding vectors of the
    primary and reference datasets

    :param primary: Dataset
    :type primary: Dataset
    :param reference: Dataset
    :type reference: Dataset
    :param embedding_feature_name: The name of the embedding feature you want to use to calculate
    the distance
    :type embedding_feature_name: str
    :return: The euclidean distance between the primary and reference centroids.
    """
    primary_vec_col: pd.Series = primary.get_embedding_vector_column(embedding_feature_name)
    reference_vec_col: pd.Series = reference.get_embedding_vector_column(embedding_feature_name)
    primary_centroid = primary_vec_col.mean()
    reference_centroid = reference_vec_col.mean()
    return np.linalg.norm(primary_centroid - reference_centroid)
