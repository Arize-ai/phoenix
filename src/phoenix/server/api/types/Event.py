from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Union, cast

import strawberry
from strawberry import ID

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    PREDICTION_ID,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    PROMPT,
    RESPONSE,
)

from ..interceptor import GqlValueMediator
from .DatasetRole import STR_TO_DATASET_ROLE, AncillaryDatasetRole, DatasetRole
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
        default=GqlValueMediator(),
    )


def create_event_id(
    row_id: int,
    dataset_role: Union[DatasetRole, AncillaryDatasetRole, ms.DatasetRole],
) -> ID:
    dataset_role_str = (
        dataset_role.value
        if isinstance(dataset_role, (DatasetRole, AncillaryDatasetRole))
        else dataset_role
    )
    return ID(f"{row_id}:{dataset_role_str}")


def unpack_event_id(
    event_id: ID,
) -> Tuple[int, Union[DatasetRole, AncillaryDatasetRole]]:
    row_id_str, dataset_role_str = str(event_id).split(":")
    row_id = int(row_id_str)
    dataset_role = STR_TO_DATASET_ROLE[dataset_role_str]
    return row_id, dataset_role


def parse_event_ids_by_dataset_role(
    event_ids: List[ID],
) -> Dict[Union[DatasetRole, AncillaryDatasetRole], List[int]]:
    """
    Parses event IDs and returns the corresponding row indexes.
    """
    row_indexes: Dict[Union[DatasetRole, AncillaryDatasetRole], List[int]] = defaultdict(list)
    for event_id in event_ids:
        row_id, dataset_role = unpack_event_id(event_id)
        row_indexes[dataset_role].append(row_id)
    return row_indexes


def create_event(
    event_id: ID,
    event: ms.Event,
    dimensions: List[Dimension],
) -> Event:
    """
    Reads dimension values and event metadata from a dataframe row and returns
    an event containing this information.
    """
    event_metadata = EventMetadata(
        prediction_id=event[PREDICTION_ID],
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
    model = cast(ms.Model, event._self_model)
    prompt = event[cast(ms.EmbeddingDimension, model[PROMPT]).raw_data]
    response = (
        event[RESPONSE]
        if not isinstance(
            response_dimension := model[RESPONSE],
            ms.EmbeddingDimension,
        )
        else event[response_dimension.raw_data]
    )
    prompt_and_response = (
        PromptResponse(
            prompt=prompt,
            response=response,
        )
        or None
    )
    return Event(
        id=event_id,
        eventMetadata=event_metadata,
        dimensions=dimensions_with_values,
        prompt_and_response=prompt_and_response,
    )
