from typing import List

import strawberry
from strawberry.scalars import ID

from .Dimension import Dimension
from .EmbeddingMetadata import EmbeddingMetadata


@strawberry.type
class EventDimensionItem:
    dimension: Dimension
    value: str


@strawberry.type
class ModelEvent:
    """An event is a record of a model prediction and it's possible actuals"""

    id: ID

    dimensions: List[EventDimensionItem]

    embeddings: List[EmbeddingMetadata]
