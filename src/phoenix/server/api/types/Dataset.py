from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry.scalars import ID
from strawberry.types import Info

from phoenix.core.dimension_type import DimensionType
from phoenix.datasets import Dataset as InternalDataset

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
        event_ids: List[ID],
        dimensions: Optional[List[DimensionInput]],
        info: Info[Context, None],
    ) -> List[Event]:
        row_indexes = [int(event_id) for event_id in event_ids]
        model = info.context.model
        dataset = model.get_dataset_by_name(dataset_name=self.name)
        dataframe = dataset.dataframe
        schema = dataset.schema
        included_dimensions: List[Dimension]
        if dimensions is not None:
            included_column_names = [dim.name for dim in dimensions] + [
                col
                for col in [
                    schema.prediction_label_column_name,
                    schema.prediction_score_column_name,
                    schema.actual_label_column_name,
                    schema.actual_score_column_name,
                ]
                if col is not None
            ]
            dataframe = dataframe[included_column_names]
            input_dimension_names = set(dim.name for dim in dimensions)
        else:
            input_dimension_names = set(dim.name for dim in model.dimensions)
        included_dimensions = [
            to_gql_dimension(id_attr=id, dimension=dim)
            for id, dim in enumerate(model.dimensions)
            if dim.type in [DimensionType.FEATURE, DimensionType.TAG]
            and dim.name in input_dimension_names
        ]

        dataframe = dataframe.iloc[row_indexes]
        events = []
        for _, row in dataframe.iterrows():
            event_metadata = EventMetadata(
                prediction_label=row[col]
                if (col := schema.prediction_label_column_name) is not None
                else None,
                prediction_score=row[col]
                if (col := schema.prediction_score_column_name) is not None
                else None,
                actual_label=row[col]
                if (col := schema.actual_label_column_name) is not None
                else None,
                actual_score=row[col]
                if (col := schema.actual_score_column_name) is not None
                else None,
            )
            dimensions_with_values = [
                DimensionWithValue(
                    dimension=dim,
                    value=row[dim.name],
                )
                for dim in included_dimensions
            ]
            events.append(Event(eventMetadata=event_metadata, dimensions=dimensions_with_values))

        return events


def to_gql_dataset(dataset: InternalDataset) -> Dataset:
    """
    Converts a phoenix.datasets.Dataset to a phoenix.server.api.types.Dataset
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
    )
