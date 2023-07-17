from datetime import datetime
from typing import Iterable, List, Optional, Set, Union

import strawberry
from strawberry.scalars import ID
from strawberry.unset import UNSET

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import FEATURE, TAG, ScalarDimension

from ..input_types.DimensionInput import DimensionInput
from .DatasetRole import AncillaryDatasetRole, DatasetRole
from .Dimension import Dimension, to_gql_dimension
from .Event import Event, create_event, create_event_id, parse_event_ids_by_dataset_role


@strawberry.type
class Dataset:
    start_time: datetime = strawberry.field(description="The start bookend of the data")
    end_time: datetime = strawberry.field(description="The end bookend of the data")
    dataset: strawberry.Private[ms.Dataset]
    dataset_role: strawberry.Private[Union[DatasetRole, AncillaryDatasetRole]]
    model: strawberry.Private[ms.Model]

    # type ignored here to get around the following: https://github.com/strawberry-graphql/strawberry/issues/1929
    @strawberry.field(description="Returns a human friendly name for the dataset.")  # type: ignore
    def name(self) -> str:
        return self.dataset.display_name

    @strawberry.field
    def events(
        self,
        event_ids: List[ID],
        dimensions: Optional[List[DimensionInput]] = UNSET,
    ) -> List[Event]:
        """
        Returns events for specific event IDs and dimensions. If no input
        dimensions are provided, returns all features and tags.
        """
        if not event_ids:
            return []
        row_ids = parse_event_ids_by_dataset_role(event_ids)
        if len(row_ids) > 1 or self.dataset_role not in row_ids:
            raise ValueError("eventIds contains IDs from incorrect dataset.")
        events = self.dataset[row_ids[self.dataset_role]]
        requested_gql_dimensions = _get_requested_features_and_tags(
            core_dimensions=self.model.scalar_dimensions,
            requested_dimension_names=set(dim.name for dim in dimensions)
            if isinstance(dimensions, list)
            else None,
        )
        return [
            create_event(
                event_id=create_event_id(event.id.row_id, self.dataset_role),
                event=event,
                dimensions=requested_gql_dimensions,
            )
            for event in events
        ]


def _get_requested_features_and_tags(
    core_dimensions: Iterable[ScalarDimension],
    requested_dimension_names: Optional[Set[str]] = UNSET,
) -> List[Dimension]:
    """
    Returns requested features and tags as a list of strawberry Datasets. If no
    dimensions are explicitly requested, returns all features and tags.
    """
    requested_features_and_tags: List[Dimension] = []
    for id, dim in enumerate(core_dimensions):
        is_requested = (
            not isinstance(requested_dimension_names, Set)
        ) or dim.name in requested_dimension_names
        is_feature_or_tag = dim.role in (FEATURE, TAG)
        if is_requested and is_feature_or_tag:
            requested_features_and_tags.append(to_gql_dimension(id_attr=id, dimension=dim))
    return requested_features_and_tags
