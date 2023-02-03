from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import numpy.typing as npt
from pandas import Series
from strawberry.dataloader import DataLoader

from phoenix.core import DimensionDataType
from phoenix.core.model import Model
from phoenix.metrics.cardinality import cardinality
from phoenix.metrics.embeddings import euclidean_distance


@dataclass
class Loaders:
    cardinality: DataLoader[str, Optional[int]]
    euclidean_distance: DataLoader[str, Optional[float]]


def create_loaders(model: Model) -> Loaders:
    return Loaders(
        cardinality=_get_cardinality_dataloader(model=model),
        euclidean_distance=_get_euclidean_distance_dataloader(model=model),
    )


def _get_cardinality_dataloader(model: Model) -> DataLoader[str, Optional[int]]:
    async def _cardinality_load_function(column_names: List[str]) -> List[Optional[int]]:
        dimension_data_type_to_column_names: Dict[DimensionDataType, List[str]] = {
            ddt: [] for ddt in DimensionDataType
        }
        for dim in model.dimensions:
            dimension_data_type_to_column_names[dim.data_type].append(dim.name)
        column_name_to_cardinality: Dict[str, Optional[int]] = {}
        column_name_to_cardinality.update(
            {col: None for col in dimension_data_type_to_column_names[DimensionDataType.NUMERIC]}
        )
        column_name_to_cardinality.update(
            cardinality(
                model.primary_dataset.dataframe,
                dimension_data_type_to_column_names[DimensionDataType.CATEGORICAL],
            )
        )
        return [column_name_to_cardinality[col] for col in column_names]

    return DataLoader(load_fn=_cardinality_load_function)


def _get_euclidean_distance_dataloader(model: Model) -> DataLoader[str, Optional[float]]:
    async def _euclidean_distance_load_function(
        embedding_feature_names: List[str],
    ) -> List[Optional[float]]:
        return [
            euclidean_distance(
                _to_array(model.primary_dataset.get_embedding_vector_column(emb)),
                _to_array(model.reference_dataset.get_embedding_vector_column(emb)),
            )
            for emb in embedding_feature_names
        ]

    return DataLoader(load_fn=_euclidean_distance_load_function)


def _to_array(embeddings_column: "Series[Any]") -> npt.NDArray[np.float64]:
    """
    Converts an embedding column to a numpy array. Given a column containing N
    entries where each entry is a numpy array of dimension M, the output array
    has dimension N x M.
    """
    return np.stack(embeddings_column.to_numpy())  # type: ignore
