from collections import defaultdict
from typing import Dict, List, Optional

import strawberry
from strawberry import ID

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    PROMPT,
    RESPONSE,
    DatasetRole,
    EventId,
)

from ..interceptor import NoneIfNan
from .Dimension import Dimension
from .DimensionWithValue import DimensionWithValue
from .EventMetadata import EventMetadata
from .PromptResponse import PromptResponse


@strawberry.type
class Event:
    id: strawberry.ID
    eventMetadata: EventMetadata
    dimensions: List[DimensionWithValue]
    prompt_and_response: Optional[PromptResponse] = strawberry.field(
        description="The prompt and response pair associated with the event",
        default=NoneIfNan(),
    )


def parse_event_ids(event_ids: List[ID]) -> Dict[DatasetRole, List[int]]:
    """
    Parses event IDs and returns the corresponding row indexes.
    """
    row_indexes: Dict[DatasetRole, List[int]] = defaultdict(list)
    for event_id in event_ids:
        row_index, dataset_role_str = str(event_id).split(":")
        dataset_role = DatasetRole[dataset_role_str.split(".")[-1]]
        row_indexes[dataset_role].append(int(row_index))
    return row_indexes


def create_event(
    event: ms.Event,
    dimensions: List[Dimension],
) -> Event:
    """
    Reads dimension values and event metadata from a dataframe row and returns
    an event containing this information.
    """
    event_metadata = EventMetadata(
        prediction_label=event[PREDICTION_LABEL],
        prediction_score=event[PREDICTION_SCORE],
        actual_label=event[ACTUAL_LABEL],
        actual_score=event[ACTUAL_SCORE],
    )
    dimensions_with_values = [
        DimensionWithValue(
            dimension=dim,
            value=event[dim.dimension],
        )
        for dim in dimensions
    ]
    row_id = event.id.row_id
    dataset_id = event.id.dataset_id
    prompt = event[event._self_model[PROMPT].raw_data]
    response = event[event._self_model[RESPONSE].raw_data]
    prompt_and_response = (
        PromptResponse(
            prompt=prompt,
            response=response,
        )
        or None
    )
    return Event(
        id=ID(str(EventId(row_id=row_id, dataset_id=dataset_id))),
        eventMetadata=event_metadata,
        dimensions=dimensions_with_values,
        prompt_and_response=prompt_and_response,
    )
