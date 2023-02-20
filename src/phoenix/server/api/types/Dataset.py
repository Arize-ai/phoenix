from datetime import datetime
from typing import Any, List, Optional, Set, Tuple

import strawberry
from pandas import Series
from strawberry.scalars import ID
from strawberry.types import Info
from strawberry.unset import UNSET

from phoenix.core.dimension import Dimension as CoreDimension
from phoenix.core.dimension_type import DimensionType
from phoenix.datasets import Dataset as InternalDataset
from phoenix.datasets import Schema
from phoenix.datasets.dataset import DatasetType

from ..context import Context
from ..input_types.DimensionInput import DimensionInput
from .Dimension import Dimension, to_gql_dimension
from .DimensionWithValue import DimensionWithValue
from .Event import Event
from .EventMetadata import EventMetadata


@strawberry.type
class Dataset:
    name: str
    start_time: datetime
    end_time: datetime

    @strawberry.field
    def events(
        self,
        info: Info[Context, None],
        event_ids: List[ID],
        dimensions: Optional[List[DimensionInput]] = UNSET,
    ) -> List[Event]:
        if not event_ids:
            return []
        dataset_type, row_indexes = self._parse_event_ids(event_ids)
        model = info.context.model
        dataset = model.primary_dataset
        if dataset_type == str(DatasetType.REFERENCE):
            if model.reference_dataset is None:
                raise ValueError("event_ids contains IDs from non-existent reference dataset.")
            dataset = model.reference_dataset
        dataframe = dataset.dataframe
        schema = dataset.schema
        requested_gql_dimensions = self._get_requested_dimensions(
            core_dimensions=model.dimensions,
            requested_dimension_names=set(dim.name for dim in dimensions)
            if isinstance(dimensions, list)
            else None,
        )
        requested_dimension_names = [dim.name for dim in requested_gql_dimensions]
        prediction_and_actual_column_names = [
            col
            for col in [
                schema.prediction_label_column_name,
                schema.prediction_score_column_name,
                schema.actual_label_column_name,
                schema.actual_score_column_name,
            ]
            if col is not None
        ]
        dataframe = dataframe[requested_dimension_names + prediction_and_actual_column_names].iloc[
            row_indexes
        ]
        return [
            self._create_event(row, schema, requested_gql_dimensions)
            for _, row in dataframe.iterrows()
        ]

    @staticmethod
    def _parse_event_ids(event_ids: List[ID]) -> Tuple[str, List[int]]:
        row_indexes = []
        dataset_types = set()
        for event_id in event_ids:
            row_index, dataset_type = str(event_id).split(":")
            row_indexes.append(int(row_index))
            dataset_types.add(dataset_type)
        if len(dataset_types) != 1:
            raise ValueError("eventIds contains IDs from multiple datasets.")
        dataset_type = dataset_types.pop()
        return dataset_type, row_indexes

    @staticmethod
    def _get_requested_dimensions(
        core_dimensions: List[CoreDimension],
        requested_dimension_names: Optional[Set[str]] = None,
    ) -> List[Dimension]:
        requested_features_and_tags = []
        for id, dim in enumerate(core_dimensions):
            is_requested = (
                requested_dimension_names is None or dim.name in requested_dimension_names
            )
            is_feature_or_tag = dim.type in [DimensionType.FEATURE, DimensionType.TAG]
            if is_requested and is_feature_or_tag:
                requested_features_and_tags.append(to_gql_dimension(id_attr=id, dimension=dim))
        return requested_features_and_tags

    @staticmethod
    def _create_event(row: "Series[Any]", schema: Schema, dimensions: List[Dimension]) -> Event:
        event_metadata = EventMetadata(
            prediction_label=row[col]
            if (col := schema.prediction_label_column_name) is not None
            else None,
            prediction_score=row[col]
            if (col := schema.prediction_score_column_name) is not None
            else None,
            actual_label=row[col] if (col := schema.actual_label_column_name) is not None else None,
            actual_score=row[col] if (col := schema.actual_score_column_name) is not None else None,
        )
        dimensions_with_values = [
            DimensionWithValue(
                dimension=dim,
                value=row[dim.name],
            )
            for dim in dimensions
        ]
        return Event(eventMetadata=event_metadata, dimensions=dimensions_with_values)


def to_gql_dataset(dataset: InternalDataset) -> Dataset:
    """
    Converts a phoenix.datasets.Dataset to a phoenix.server.api.types.Dataset
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )
