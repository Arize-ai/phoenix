#                  Copyright 2023 Arize AI and contributors.
#                   Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

from typing import Any

import numpy as np
import pandas as pd

from phoenix.datasets import Dataset


def euclidean_distance(
    primary: Dataset,
    reference: Dataset,
    embedding_feature_name: str,
) -> float:
    primary_vec_col: pd.Series[Any] = primary.get_embedding_vector_column(embedding_feature_name)
    reference_vec_col: pd.Series[Any] = reference.get_embedding_vector_column(
        embedding_feature_name
    )
    primary_centroid = primary_vec_col.mean()
    reference_centroid = reference_vec_col.mean()
    return np.linalg.norm(primary_centroid - reference_centroid).item()
