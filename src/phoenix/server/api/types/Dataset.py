from datetime import datetime
from typing import Iterable, List, Optional, Set

import strawberry
from strawberry.scalars import ID
from strawberry.types import Info
from strawberry.unset import UNSET

import phoenix.core.model_schema as ms

from ..context import Context
from ..input_types.DimensionInput import DimensionInput
from .Dimension import Dimension, to_gql_dimension
from .Event import Event, create_event, parse_event_ids


@strawberry.type
class Dataset:
    name: str = strawberry.field(description="The given name of the dataset")
    start_time: datetime = strawberry.field(description="The start bookend of the data")
    end_time: datetime = strawberry.field(description="The end bookend of the data")
    dataset: strawberry.Private[ms.Dataset]

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
        if len(row_ids) > 1 or self.dataset.role not in row_ids:
            raise ValueError("eventIds contains IDs from incorrect dataset.")
        events = self.dataset[row_ids[self.dataset.role]]
        requested_gql_dimensions = _get_requested_features_and_tags(
            core_dimensions=info.context.model.scalar_dimensions,
            requested_dimension_names=set(dim.name for dim in dimensions)
            if isinstance(dimensions, list)
            else None,
        )
        return [
            create_event(
                event=event,
                dimensions=requested_gql_dimensions,
            )
            for event in events
        ]


def _get_requested_features_and_tags(
    core_dimensions: Iterable[ms.ScalarDimension],
    requested_dimension_names: Optional[Set[str]] = None,
) -> List[Dimension]:
    """
    Returns requested features and tags as a list of strawberry Datasets. If no
    dimensions are explicitly requested, returns all features and tags.
    """
    requested_features_and_tags: List[Dimension] = []
    for id, dim in enumerate(core_dimensions):
        is_requested = requested_dimension_names is None or dim.name in requested_dimension_names
        is_feature_or_tag = dim.role in (ms.FEATURE, ms.TAG)
        if is_requested and is_feature_or_tag:
            requested_features_and_tags.append(to_gql_dimension(id_attr=id, dimension=dim))
    return requested_features_and_tags
