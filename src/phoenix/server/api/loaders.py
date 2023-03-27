from dataclasses import dataclass
from typing import Dict, List, Optional

from strawberry.dataloader import DataLoader

from phoenix.core import DimensionDataType
from phoenix.core.model import Model
from phoenix.metrics.cardinality import cardinality
from phoenix.metrics.percent_empty import percent_empty


@dataclass
class Loaders:
    cardinality: DataLoader[str, Optional[int]]
    percent_empty: DataLoader[str, Optional[float]]


def create_loaders(model: Model) -> Loaders:
    return Loaders(
        cardinality=_get_cardinality_dataloader(model=model),
        percent_empty=_get_percent_empty_dataloader(model=model),
    )


def _get_cardinality_dataloader(model: Model) -> DataLoader[str, Optional[int]]:
    async def _cardinality_load_function(column_names: List[str]) -> List[Optional[int]]:
        dimension_data_type_to_column_names: Dict[DimensionDataType, List[str]] = {ddt: [] for ddt in DimensionDataType}
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


def _get_percent_empty_dataloader(model: Model) -> DataLoader[str, Optional[float]]:
    async def _percent_empty_load_function(column_names: List[str]) -> List[Optional[float]]:
        column_name_to_percent_empty = percent_empty(
            dataframe=model.primary_dataset.dataframe, column_names=column_names
        )
        return [column_name_to_percent_empty[col] for col in column_names]

    return DataLoader(load_fn=_percent_empty_load_function)
