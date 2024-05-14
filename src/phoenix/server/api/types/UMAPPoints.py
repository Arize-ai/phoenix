from typing import List, Union

import numpy as np
import numpy.typing as npt
import strawberry
from strawberry.relay.types import GlobalID
from strawberry.scalars import ID

from phoenix.server.api.types.Cluster import Cluster

from .EmbeddingMetadata import EmbeddingMetadata
from .EventMetadata import EventMetadata
from .Retrieval import Retrieval


@strawberry.type
class Point3D:
    x: float
    y: float
    z: float


@strawberry.type
class Point2D:
    x: float
    y: float


def to_gql_coordinates(vector: npt.NDArray[np.float64]) -> Union[Point2D, Point3D]:
    if vector.shape[0] == 2:
        return Point2D(x=vector[0], y=vector[1])
    if vector.shape[0] == 3:
        return Point3D(x=vector[0], y=vector[1], z=vector[2])
    raise ValueError("invalid vector shape for coordinate")


@strawberry.type
class UMAPPoint:
    """point and metadata for a UMAP plot"""

    """A unique ID for the the point"""
    id: GlobalID

    event_id: ID = strawberry.field(
        description="The ID of the event that the point is a projection of"
    )

    """The coordinates of the point. Can be two or three dimensional"""
    coordinates: Union[Point2D, Point3D]

    """The metadata associated with the embedding"""
    embedding_metadata: EmbeddingMetadata

    """A summary of the predictions and actuals of the model event"""
    event_metadata: EventMetadata


@strawberry.type
class UMAPPoints:
    data: List[UMAPPoint]
    reference_data: List[UMAPPoint]
    clusters: List[Cluster]
    corpus_data: List[UMAPPoint] = strawberry.field(default_factory=list)
    context_retrievals: List[Retrieval] = strawberry.field(default_factory=list)
