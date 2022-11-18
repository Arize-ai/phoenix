"""
Embedding metrics.
"""

import numpy as np

from arize_toolbox import Dataset


def euclidean_distance(
    primary: Dataset, reference: Dataset, embedding_feature_name: str
) -> np.ndarray:
    primary_series = primary.get_embedding_vector_column(embedding_feature_name)
    reference_series = reference.get_embedding_vector_column(embedding_feature_name)
    primary_centroid = primary_series.mean()
    reference_centroid = reference_series.mean()
    return np.linalg.norm(primary_centroid - reference_centroid)
