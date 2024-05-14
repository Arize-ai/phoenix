from datetime import datetime
from typing import Iterable, List, Optional, Set, Union

import strawberry
from strawberry.scalars import ID
from strawberry.unset import UNSET

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import FEATURE, TAG, ScalarDimension

from ..input_types.DimensionInput import DimensionInput
from .Dimension import Dimension, to_gql_dimension
from .Event import Event, create_event, create_event_id, parse_event_ids_by_inferences_role
from .InferencesRole import AncillaryInferencesRole, InferencesRole


@strawberry.type
class Inferences:
    start_time: datetime = strawberry.field(description="The start bookend of the data")
    end_time: datetime = strawberry.field(description="The end bookend of the data")
    record_count: int = strawberry.field(description="The record count of the data")
    inferences: strawberry.Private[ms.Inferences]
    inferences_role: strawberry.Private[Union[InferencesRole, AncillaryInferencesRole]]
    model: strawberry.Private[ms.Model]

    # type ignored here to get around the following: https://github.com/strawberry-graphql/strawberry/issues/1929
    @strawberry.field(description="Returns a human friendly name for the inferences.")  # type: ignore
    def name(self) -> str:
        return self.inferences.display_name

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
        row_ids = parse_event_ids_by_inferences_role(event_ids)
        if len(row_ids) > 1 or self.inferences_role not in row_ids:
            raise ValueError("eventIds contains IDs from incorrect inferences.")
        events = self.inferences[row_ids[self.inferences_role]]
        requested_gql_dimensions = _get_requested_features_and_tags(
            core_dimensions=self.model.scalar_dimensions,
            requested_dimension_names=set(dim.name for dim in dimensions)
            if isinstance(dimensions, list)
            else None,
        )
        return [
            create_event(
                event_id=create_event_id(event.id.row_id, self.inferences_role),
                event=event,
                dimensions=requested_gql_dimensions,
                is_document_record=self.inferences_role is AncillaryInferencesRole.corpus,
            )
            for event in events
        ]


def _get_requested_features_and_tags(
    core_dimensions: Iterable[ScalarDimension],
    requested_dimension_names: Optional[Set[str]] = UNSET,
) -> List[Dimension]:
    """
    Returns requested features and tags as a list of strawberry Inferences. If no
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
