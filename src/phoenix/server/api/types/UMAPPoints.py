from typing import List, Optional, Union

import numpy as np
import numpy.typing as npt
import strawberry
from strawberry.scalars import ID
from typing_extensions import TypeAlias

EventId: TypeAlias = ID
ClusterId: TypeAlias = ID


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
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    raw_data: Optional[str]
    link_to_data: Optional[str]


@strawberry.type
class EventMetadata:
    """A partial record of a model event. E.g. the predictions and actuals"""

    prediction_score: Optional[float]
    prediction_label: Optional[str]
    actual_score: Optional[float]
    actual_label: Optional[str]


@strawberry.type
class UMAPPoint:
    """point and metadata for a UMAP plot"""

    """A unique ID for the the point"""
    id: EventId

    """The coordinates of the point. Can be two or three dimensional"""
    coordinates: Union[Point2D, Point3D]

    """The metadata associated with the embedding"""
    embedding_metadata: EmbeddingMetadata

    """A summary of the predictions and actuals of the model event"""
    event_metadata: EventMetadata


@strawberry.type
class Cluster:
    """A grouping of points in a UMAP plot"""

    """The ID of the cluster"""
    id: ClusterId

    """A list of points that belong to the cluster"""
    point_ids: List[EventId]


@strawberry.type
class UMAPPoints:
    data: List[UMAPPoint]
    reference_data: List[UMAPPoint]
    clusters: List[Cluster]
