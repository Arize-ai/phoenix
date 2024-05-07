from collections import defaultdict
from typing import Dict, List, Optional, Set, Union

import numpy as np
import numpy.typing as npt
import strawberry
from sqlalchemy import delete, select
from sqlalchemy.orm import contains_eager, load_only
from strawberry import ID, UNSET
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.insertion.span import ClearProjectSpansResult
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.context import Context
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import (
    InputCoordinate2D,
    InputCoordinate3D,
)
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters
from phoenix.server.api.types.DatasetRole import AncillaryDatasetRole, DatasetRole
from phoenix.server.api.types.Dimension import to_gql_dimension
from phoenix.server.api.types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from phoenix.server.api.types.Event import create_event_id, unpack_event_id
from phoenix.server.api.types.ExportEventsMutation import ExportEventsMutation
from phoenix.server.api.types.Functionality import Functionality
from phoenix.server.api.types.Model import Model
from phoenix.server.api.types.node import (
    GlobalID,
    Node,
    from_global_id,
    from_global_id_with_expected_type,
)
from phoenix.server.api.types.pagination import (
    Connection,
    ConnectionArgs,
    Cursor,
    connection_from_list,
)
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Span import to_gql_span
from phoenix.server.api.types.Trace import Trace


@strawberry.type
class Query:
    @strawberry.field
    async def projects(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[Project]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        async with info.context.db() as session:
            projects = await session.scalars(select(models.Project))
        data = [
            Project(
                id_attr=project.id,
                name=project.name,
                gradient_start_color=project.gradient_start_color,
                gradient_end_color=project.gradient_end_color,
            )
            for project in projects
        ]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def functionality(self, info: Info[Context, None]) -> "Functionality":
        has_model_inferences = not info.context.model.is_empty
        async with info.context.db() as session:
            has_traces = (await session.scalar(select(models.Trace).limit(1))) is not None
        return Functionality(
            model_inferences=has_model_inferences,
            tracing=has_traces,
        )

    @strawberry.field
    def model(self) -> Model:
        return Model()

    @strawberry.field
    async def node(self, id: GlobalID, info: Info[Context, None]) -> Node:
        type_name, node_id = from_global_id(str(id))
        if type_name == "Dimension":
            dimension = info.context.model.scalar_dimensions[node_id]
            return to_gql_dimension(node_id, dimension)
        elif type_name == "EmbeddingDimension":
            embedding_dimension = info.context.model.embedding_dimensions[node_id]
            return to_gql_embedding_dimension(node_id, embedding_dimension)
        elif type_name == "Project":
            project_stmt = select(
                models.Project.id,
                models.Project.name,
                models.Project.gradient_start_color,
                models.Project.gradient_end_color,
            ).where(models.Project.id == node_id)
            async with info.context.db() as session:
                project = (await session.execute(project_stmt)).first()
            if project is None:
                raise ValueError(f"Unknown project: {id}")
            return Project(
                id_attr=project.id,
                name=project.name,
                gradient_start_color=project.gradient_start_color,
                gradient_end_color=project.gradient_end_color,
            )
        elif type_name == "Trace":
            trace_stmt = select(models.Trace.id).where(models.Trace.id == node_id)
            async with info.context.db() as session:
                id_attr = await session.scalar(trace_stmt)
            if id_attr is None:
                raise ValueError(f"Unknown trace: {id}")
            return Trace(id_attr=id_attr)
        elif type_name == "Span":
            span_stmt = (
                select(models.Span)
                .join(models.Trace)
                .options(contains_eager(models.Span.trace))
                .where(models.Span.id == node_id)
            )
            async with info.context.db() as session:
                span = await session.scalar(span_stmt)
            if span is None:
                raise ValueError(f"Unknown span: {id}")
            return to_gql_span(span)
        raise Exception(f"Unknown node type: {type_name}")

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
            Optional[List[InputCoordinate2D]],
            strawberry.argument(
                description="Point coordinates. Must be either 2D or 3D.",
            ),
        ] = UNSET,
        coordinates_3d: Annotated[
            Optional[List[InputCoordinate3D]],
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
            grouped_coordinates[DatasetRole.primary]
            + grouped_coordinates[DatasetRole.reference]
            + grouped_coordinates[AncillaryDatasetRole.corpus]
        )

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


@strawberry.type
class Mutation(ExportEventsMutation):
    @strawberry.mutation
    async def delete_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        node_id = from_global_id_with_expected_type(str(id), "Project")
        async with info.context.db() as session:
            project = await session.scalar(
                select(models.Project)
                .where(models.Project.id == node_id)
                .options(load_only(models.Project.name))
            )
            if project is None:
                raise ValueError(f"Unknown project: {id}")
            if project.name == DEFAULT_PROJECT_NAME:
                raise ValueError(f"Cannot delete the {DEFAULT_PROJECT_NAME} project")
            await session.delete(project)
        return Query()

    @strawberry.mutation
    async def clear_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        project_id = from_global_id_with_expected_type(str(id), "Project")
        delete_statement = delete(models.Trace).where(models.Trace.project_rowid == project_id)
        async with info.context.db() as session:
            await session.execute(delete_statement)
            if cache := info.context.cache_for_dataloaders:
                cache.invalidate(ClearProjectSpansResult(project_rowid=project_id))
        return Query()


# This is the schema for generating `schema.graphql`.
# See https://strawberry.rocks/docs/guides/schema-export
# It should be kept in sync with the server's runtime-initialized
# instance. To do so, search for the usage of `strawberry.Schema(...)`.
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)
