from typing import List

import strawberry

from .DimensionWithValue import DimensionWithValue
from .EventMetadata import EventMetadata


@strawberry.type
class Event:
    id: strawberry.ID
    eventMetadata: EventMetadata
    dimensions: List[DimensionWithValue]
