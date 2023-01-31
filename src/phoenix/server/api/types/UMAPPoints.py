from typing import List, Union
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
class UMAPPoint:
    """point and meta data for a UMAP plot"""

    """A unique ID for the the point"""
    uuid: UUID

    """The prediction ID that the point is derived from"""
    prediction_id: ID

    """The coordinates of the point. Can be two or three dimensional"""
    coordinates: Union[Point3D, Point3D]


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
