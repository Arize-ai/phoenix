from dataclasses import dataclass
from functools import partial
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Sequence,
    TypeVar,
    Union,
)

from strawberry.dataloader import DataLoader

from phoenix.core import DimensionDataType
from phoenix.core.model import Model
from phoenix.metrics.cardinality import cardinality

T = TypeVar("T")
MetricLoadFunction = Callable[[Model, List[str]], Awaitable[Sequence[Union[T, BaseException]]]]
LoadFunction = Callable[[List[str]], Awaitable[Sequence[Union[T, BaseException]]]]


@dataclass
class MetricLoader:
    cardinality: DataLoader[str, Optional[int]]


async def cardinality_load_function(model: Model, column_names: List[str]) -> List[Optional[int]]:
    column_name_to_cardinality: Dict[str, Optional[int]] = {}
    dimension_data_type_to_column_names: Dict[DimensionDataType, List[str]] = {
        ddt: [] for ddt in DimensionDataType
    }
    for column_name in column_names:
        dimension_data_type = model.primary_dataset.get_dimension_data_type(column_name)
        dimension_data_type_to_column_names[dimension_data_type].append(column_name)
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


def get_metric_dataloader(
    model: Model, metric_load_fn: MetricLoadFunction[T], **kwargs: Any
) -> DataLoader[str, T]:
    load_fn: LoadFunction[T] = partial(metric_load_fn, model)
    dataloader: DataLoader[str, T] = DataLoader(load_fn=load_fn, **kwargs)
    return dataloader


def get_default_loader(model: Model) -> MetricLoader:
    cardinality_dataloader = get_metric_dataloader(
        model=model, metric_load_fn=cardinality_load_function
    )
    return MetricLoader(cardinality=cardinality_dataloader)
