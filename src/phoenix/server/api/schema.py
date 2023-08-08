from collections import defaultdict
from itertools import chain
from typing import Dict, List, Optional, Set, Union

import numpy as np
import numpy.typing as npt
import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters

from .context import Context
from .input_types import Coordinates
from .types.DatasetRole import AncillaryDatasetRole, DatasetRole
from .types.Dimension import to_gql_dimension
from .types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from .types.Event import create_event_id, unpack_event_id
from .types.ExportEventsMutation import ExportEventsMutation
from .types.Model import Model
from .types.node import GlobalID, Node, from_global_id
from .types.pagination import Connection, ConnectionArgs, Cursor, connection_from_list
from .types.Span import Span, SpanContext


@strawberry.type
class Query:
    @strawberry.field
    def model(self) -> Model:
        return Model()

    @strawberry.field
    def node(self, id: GlobalID, info: Info[Context, None]) -> Node:
        type_name, node_id = from_global_id(str(id))
        if type_name == "Dimension":
            dimension = info.context.model.scalar_dimensions[node_id]
            return to_gql_dimension(node_id, dimension)
        elif type_name == "EmbeddingDimension":
            embedding_dimension = info.context.model.embedding_dimensions[node_id]
            return to_gql_embedding_dimension(node_id, embedding_dimension)

        raise Exception(f"Unknown node type: {type}")

    @strawberry.field
    def clusters(
        self,
        clusters: List[ClusterInput],
    ) -> List[Cluster]:
        clustered_events: Dict[str, Set[ID]] = defaultdict(set)
        for i, cluster in enumerate(clusters):
            clustered_events[cluster.id or str(i)].update(cluster.event_ids)
        return to_gql_clusters(
            clustered_events=clustered_events,
        )

    @strawberry.field
    def hdbscan_clustering(
        self,
        info: Info[Context, None],
        event_ids: Annotated[
            List[ID],
            strawberry.argument(
                description="Event ID of the coordinates",
            ),
        ],
        coordinates_2d: Annotated[
            Optional[List[Coordinates.InputCoordinate2D]],
            strawberry.argument(
                description="Point coordinates. Must be either 2D or 3D.",
            ),
        ] = UNSET,
        coordinates_3d: Annotated[
            Optional[List[Coordinates.InputCoordinate3D]],
            strawberry.argument(
                description="Point coordinates. Must be either 2D or 3D.",
            ),
        ] = UNSET,
        min_cluster_size: Annotated[
            int,
            strawberry.argument(
                description="HDBSCAN minimum cluster size",
            ),
        ] = DEFAULT_MIN_CLUSTER_SIZE,
        cluster_min_samples: Annotated[
            int,
            strawberry.argument(
                description="HDBSCAN minimum samples",
            ),
        ] = DEFAULT_MIN_SAMPLES,
        cluster_selection_epsilon: Annotated[
            float,
            strawberry.argument(
                description="HDBSCAN cluster selection epsilon",
            ),
        ] = DEFAULT_CLUSTER_SELECTION_EPSILON,
    ) -> List[Cluster]:
        coordinates_3d = ensure_list(coordinates_3d)
        coordinates_2d = ensure_list(coordinates_2d)

        if len(coordinates_3d) > 0 and len(coordinates_2d) > 0:
            raise ValueError("must specify only one of 2D or 3D coordinates")

        if len(coordinates_3d) > 0:
            coordinates = list(
                map(
                    lambda coord: np.array(
                        [coord.x, coord.y, coord.z],
                    ),
                    coordinates_3d,
                )
            )
        else:
            coordinates = list(
                map(
                    lambda coord: np.array(
                        [coord.x, coord.y],
                    ),
                    coordinates_2d,
                )
            )

        if len(event_ids) != len(coordinates):
            raise ValueError(
                f"length mismatch between "
                f"event_ids ({len(event_ids)}) "
                f"and coordinates ({len(coordinates)})"
            )

        if len(event_ids) == 0:
            return []

        grouped_event_ids: Dict[
            Union[DatasetRole, AncillaryDatasetRole],
            List[ID],
        ] = defaultdict(list)
        grouped_coordinates: Dict[
            Union[DatasetRole, AncillaryDatasetRole],
            List[npt.NDArray[np.float64]],
        ] = defaultdict(list)

        for event_id, coordinate in zip(event_ids, coordinates):
            row_id, dataset_role = unpack_event_id(event_id)
            grouped_coordinates[dataset_role].append(coordinate)
            grouped_event_ids[dataset_role].append(create_event_id(row_id, dataset_role))

        stacked_event_ids = (
            grouped_event_ids[DatasetRole.primary]
            + grouped_event_ids[DatasetRole.reference]
            + grouped_event_ids[AncillaryDatasetRole.corpus]
        )
        stacked_coordinates = np.stack(
            chain(
                grouped_coordinates[DatasetRole.primary],
                grouped_coordinates[DatasetRole.reference],
                grouped_coordinates[AncillaryDatasetRole.corpus],
            )
        )  # type: ignore

        clusters = Hdbscan(
            min_cluster_size=min_cluster_size,
            min_samples=cluster_min_samples,
            cluster_selection_epsilon=cluster_selection_epsilon,
        ).find_clusters(stacked_coordinates)

        clustered_events = {
            str(i): {stacked_event_ids[row_idx] for row_idx in cluster}
            for i, cluster in enumerate(clusters)
        }

        return to_gql_clusters(
            clustered_events=clustered_events,
        )

    @strawberry.field
    def spans(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[Span]:
        # Convert dataframe rows to Span objects
        spans = (
            []
            if info.context.traces is None
            else [
                Span(
                    name=row["name"],
                    parent_id=row["parent_id"],
                    span_kind=row["span_kind"],
                    context=SpanContext(
                        trace_id=row["context.trace_id"],
                        span_id=row["context.span_id"],
                    ),
                )
                for _, row in info.context.traces._dataframe.iterrows()
            ]
        )

        return connection_from_list(
            data=spans,
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )


@strawberry.type
class Mutation(ExportEventsMutation):
    ...


schema = strawberry.Schema(query=Query, mutation=Mutation)
