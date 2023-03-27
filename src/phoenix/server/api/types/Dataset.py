from datetime import datetime
from typing import List, Literal, Optional, Set

import strawberry
from strawberry.scalars import ID
from strawberry.types import Info
from strawberry.unset import UNSET

from phoenix.core.dimension import Dimension as CoreDimension
from phoenix.core.dimension_type import DimensionType
from phoenix.datasets import Dataset as InternalDataset
from phoenix.datasets.dataset import DatasetType

from ..context import Context
from ..input_types.DimensionInput import DimensionInput
from .Dimension import Dimension, to_gql_dimension
from .Event import Event, create_event, parse_event_ids


@strawberry.type
class Dataset:
    name: str = strawberry.field(description="The given name of the dataset")
    start_time: datetime = strawberry.field(description="The start bookend of the data")
    end_time: datetime = strawberry.field(description="The end bookend of the data")
    dataset: strawberry.Private[InternalDataset]
    type: strawberry.Private[DatasetType]

    @strawberry.field
    def events(
        self,
        info: Info[Context, None],
        event_ids: List[ID],
        dimensions: Optional[List[DimensionInput]] = UNSET,
    ) -> List[Event]:
        """
        Returns events for specific event IDs and dimensions. If no input
        dimensions are provided, returns all features and tags.
        """
        if not event_ids:
            return []
        row_ids = parse_event_ids(event_ids)
        if len(row_ids) > 1 or self.type not in row_ids:
            raise ValueError("eventIds contains IDs from incorrect dataset.")
        row_indexes = row_ids.pop(self.type, [])
        dataframe = self.dataset.dataframe
        schema = self.dataset.schema
        requested_gql_dimensions = _get_requested_features_and_tags(
            core_dimensions=info.context.model.dimensions,
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
        column_indexes = [
            dataframe.columns.get_loc(name)
            for name in (requested_dimension_names + prediction_and_actual_column_names)
        ]
        return [
            create_event(
                row_index=row_index,
                dataset_type=self.type,
                row=dataframe.iloc[row_index, column_indexes],
                schema=schema,
                dimensions=requested_gql_dimensions,
            )
            for row_index in row_indexes
        ]


def to_gql_dataset(dataset: InternalDataset, type: Literal["primary", "reference"]) -> Dataset:
    """
    Converts an internal dataset to a strawberry Dataset type.
    """
    return Dataset(
        name=dataset.name,
        start_time=dataset.start_time,
        end_time=dataset.end_time,
        type=DatasetType.PRIMARY if type == "primary" else DatasetType.REFERENCE,
        dataset=dataset,
    )


def _get_requested_features_and_tags(
    core_dimensions: List[CoreDimension],
    requested_dimension_names: Optional[Set[str]] = None,
) -> List[Dimension]:
    """
    Returns requested features and tags as a list of strawberry Datasets. If no
    dimensions are explicitly requested, returns all features and tags.
    """
    requested_features_and_tags = []
    for id, dim in enumerate(core_dimensions):
        is_requested = requested_dimension_names is None or dim.name in requested_dimension_names
        is_feature_or_tag = dim.type in [DimensionType.FEATURE, DimensionType.TAG]
        if is_requested and is_feature_or_tag:
            requested_features_and_tags.append(to_gql_dimension(id_attr=id, dimension=dim))
    return requested_features_and_tags
