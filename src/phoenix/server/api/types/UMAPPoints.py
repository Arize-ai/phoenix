from typing import List, Optional, Union
from uuid import UUID

import strawberry
from strawberry.scalars import ID


@strawberry.type
class Point3D:
    x: float
    y: float
    z: float


@strawberry.type
class Point2D:
    x: float
    y: float


@strawberry.type
class EmbeddingMetadata:
    """Embedding specific metadata. E.g. the raw text and image source"""

    raw_data: Optional[str]
    link_to_data: Optional[str]


# TODO: Flesh out how this can be lazily fetched if needed
# @strawberry.type
# class EventMetadata:
#     """The metadata associated with a specific prediction event"""

#     prediction_id: ID
#     prediction_score: Optional[float]
#     prediction_label: Optional[str]
#     actual_score: Optional[float]
#     actual_label: Optional[str]


@strawberry.type
class UMAPPoint:
    """point and meta data for a UMAP plot"""

    """A unique ID for the the point"""
    uuid: UUID

    """The coordinates of the point. Can be two or three dimensional"""
    coordinates: Union[Point2D, Point3D]

    """The metadata associated with the embedding"""
    embedding_metadata: EmbeddingMetadata

    # """The metadata associated with the prediction event"""
    # event_metadata: EventMetadata


@strawberry.type
class Cluster:
    """A grouping of points in a UMAP plot"""

    """The ID of the cluster"""
    id: ID

    """A list of points that belong to the cluster"""
    point_uuids: List[UUID]


@strawberry.type
class UMAPPoints:
    data: List[UMAPPoint]
    reference_data: List[UMAPPoint]
    clusters: List[Cluster]
