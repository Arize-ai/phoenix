from typing import List

import strawberry

from .DimensionWithValue import DimensionWithValue
from .EventMetadata import EventMetadata


@strawberry.type
class Event:
    eventMetadata: EventMetadata
    dimensions: List[DimensionWithValue]
