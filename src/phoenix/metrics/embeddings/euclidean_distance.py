import numpy as np
import pandas as pd

from phoenix.datasets import Dataset


def euclidean_distance(
    primary: Dataset,
    reference: Dataset,
    embedding_column_name: str,
) -> float:
    primary_vec_col: pd.Series = primary.get_embedding_vector_column(embedding_column_name)
    reference_vec_col: pd.Series = reference.get_embedding_vector_column(embedding_column_name)
    primary_centroid = primary_vec_col.mean()
    reference_centroid = reference_vec_col.mean()
    return np.linalg.norm(primary_centroid - reference_centroid).item()
