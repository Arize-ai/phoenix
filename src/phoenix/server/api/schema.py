from collections import defaultdict
from itertools import chain
from typing import List, Optional

import numpy as np
import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core.model_schema import (
    PRIMARY,
    REFERENCE,
    EventId,
)
from phoenix.pointcloud.clustering import Hdbscan

from .context import Context
from .input_types import Coordinates
from .types.Dimension import to_gql_dimension
from .types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from .types.Event import unpack_event_id
from .types.ExportEventsMutation import ExportEventsMutation
from .types.Model import Model
from .types.node import GlobalID, Node, from_global_id
from .types.UMAPPoints import Cluster, to_gql_clusters


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
    def hdbscan_clustering(
        self,
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
            int,
            strawberry.argument(
                description="HDBSCAN cluster selection epsilon",
            ),
        ] = DEFAULT_CLUSTER_SELECTION_EPSILON,
    ) -> List[Cluster]:
        if not isinstance(coordinates_3d, list):
            coordinates_3d = []
        if not isinstance(coordinates_2d, list):
            coordinates_2d = []

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

        grouped_event_ids = defaultdict(list)
        grouped_coordinates = defaultdict(list)

        for event_id, coordinate in zip(event_ids, coordinates):
            row_id, dataset_role = unpack_event_id(event_id)
            grouped_coordinates[dataset_role].append(coordinate)
            grouped_event_ids[dataset_role].append(
                EventId(
                    row_id=row_id,
                    dataset_id=dataset_role,
                )
            )

        stacked_event_ids = grouped_event_ids[PRIMARY] + grouped_event_ids[REFERENCE]
        stacked_coordinates = np.stack(
            chain(
                grouped_coordinates[PRIMARY],
                grouped_coordinates[REFERENCE],
            )
        )  # type: ignore

        clusters = Hdbscan(
            min_cluster_size=min_cluster_size,
            min_samples=cluster_min_samples,
            cluster_selection_epsilon=cluster_selection_epsilon,
        ).find_clusters(stacked_coordinates)

        cluster_membership = {
            stacked_event_ids[row_id]: cluster_id
            for cluster_id, cluster in enumerate(clusters)
            for row_id in cluster
        }

        return to_gql_clusters(
            cluster_membership,
            has_reference_data=len(grouped_event_ids[REFERENCE]) > 0,
        )


@strawberry.type
class Mutation(ExportEventsMutation):
    ...


schema = strawberry.Schema(query=Query, mutation=Mutation)
