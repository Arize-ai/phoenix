from typing import Dict, List, Optional, Set, Union

import numpy as np
import numpy.typing as npt
import strawberry
from strawberry.scalars import ID
from typing_extensions import TypeAlias

from phoenix.datasets.dataset import DatasetType
from phoenix.datasets.event import EventId

from .EmbeddingMetadata import EmbeddingMetadata
from .EventMetadata import EventMetadata

ClusterId: TypeAlias = ID


@strawberry.type
class Cluster:
    """A grouping of points in a UMAP plot"""

    """The ID of the cluster"""
    id: ID

    """A list of points that belong to the cluster"""
    point_ids: List[EventId]

    """A list of points that belong to the cluster"""
    drift_ratio: Optional[float] = strawberry.field(
        description="ratio of primary points over reference points"
    )


def to_gql_clusters(cluster_membership: Dict[EventId, int]) -> List[Cluster]:
    clusters: Dict[int, Set[EventId]] = {}
    for event_id, cluster_id in cluster_membership.items():
        if clusters[cluster_id] is None:
            clusters[cluster_id] = {event_id}
        else:
            clusters[cluster_id].add(event_id)

    gql_clusters: List[Cluster] = []
    for cluster_id, cluster_events in clusters.items():
        gql_clusters.append(
            Cluster(
                id=ID(str(cluster_id)),
                point_ids=list(cluster_events),
                drift_ratio=_calculate_drift_ratio(cluster_events),
            )
        )

    return gql_clusters


def _calculate_drift_ratio(events: Set[EventId]) -> float:
    primary_point_count = 0
    reference_point_count = 0

    for event in events:
        if event.dataset_id == DatasetType.PRIMARY:
            primary_point_count += 1
        else:
            reference_point_count += 1

    return (primary_point_count - reference_point_count) / (
        primary_point_count + reference_point_count
    )


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
    id: ID

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
