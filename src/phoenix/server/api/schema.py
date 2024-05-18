from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Union

import numpy as np
import numpy.typing as npt
import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import contains_eager, load_only
from strawberry import ID, UNSET
from strawberry.relay import Connection, GlobalID, Node
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.insertion.span import ClearProjectSpansEvent
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.context import Context
from phoenix.server.api.datasets_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import (
    InputCoordinate2D,
    InputCoordinate3D,
)
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters
from phoenix.server.api.types.Dataset import Dataset
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
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole
from phoenix.server.api.types.Model import Model
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.Trace import Trace


@strawberry.type
class Query:
    @strawberry.field
    async def projects(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Project]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
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
    async def datasets(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Dataset]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            datasets = await session.scalars(select(models.Dataset))
        data = [
            Dataset(
                id_attr=dataset.id,
                name=dataset.name,
                description=dataset.description,
                created_at=dataset.created_at,
                updated_at=dataset.updated_at,
                metadata=dataset.metadata_,
            )
            for dataset in datasets
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
        type_name, node_id = from_global_id(id)
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
        elif type_name == "Dataset":
            dataset_stmt = select(
                models.Dataset.id,
                models.Dataset.name,
                models.Dataset.description,
                models.Dataset.created_at,
                models.Dataset.updated_at,
                models.Dataset.metadata_,
            ).where(models.Dataset.id == node_id)
            async with info.context.db() as session:
                dataset = (await session.execute(dataset_stmt)).first()
            if dataset is None:
                raise ValueError(f"Unknown dataset: {id}")
            return Dataset(
                id_attr=dataset.id,
                name=dataset.name,
                description=dataset.description,
                created_at=dataset.created_at,
                updated_at=dataset.updated_at,
                metadata=dataset.metadata_,
            )
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
            Union[InferencesRole, AncillaryInferencesRole],
            List[ID],
        ] = defaultdict(list)
        grouped_coordinates: Dict[
            Union[InferencesRole, AncillaryInferencesRole],
            List[npt.NDArray[np.float64]],
        ] = defaultdict(list)

        for event_id, coordinate in zip(event_ids, coordinates):
            row_id, inferences_role = unpack_event_id(event_id)
            grouped_coordinates[inferences_role].append(coordinate)
            grouped_event_ids[inferences_role].append(create_event_id(row_id, inferences_role))

        stacked_event_ids = (
            grouped_event_ids[InferencesRole.primary]
            + grouped_event_ids[InferencesRole.reference]
            + grouped_event_ids[AncillaryInferencesRole.corpus]
        )
        stacked_coordinates = np.stack(
            grouped_coordinates[InferencesRole.primary]
            + grouped_coordinates[InferencesRole.reference]
            + grouped_coordinates[AncillaryInferencesRole.corpus]
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


@strawberry.input
class AddSpansToDatasetInput:
    dataset_id: GlobalID
    span_ids: List[GlobalID]
    dataset_version_description: Optional[str] = UNSET
    dataset_version_metadata: Optional[JSON] = UNSET


@strawberry.type
class AddSpansToDatasetPayload:
    dataset: Dataset


@strawberry.type
class DatasetMutation:
    @strawberry.mutation
    async def create_dataset(
        self,
        info: Info[Context, None],
        name: str,
        description: Optional[str] = None,
        metadata: Optional[JSON] = None,
    ) -> Dataset:
        metadata = metadata or {}
        async with info.context.db() as session:
            result = await session.execute(
                insert(models.Dataset)
                .values(
                    name=name,
                    description=description,
                    metadata_=metadata,
                )
                .returning(
                    models.Dataset.id,
                    models.Dataset.name,
                    models.Dataset.description,
                    models.Dataset.created_at,
                    models.Dataset.updated_at,
                    models.Dataset.metadata_,
                )
            )
            if not (row := result.fetchone()):
                raise ValueError("Failed to create dataset")
            return Dataset(
                id_attr=row.id,
                name=row.name,
                description=row.description,
                created_at=row.created_at,
                updated_at=row.updated_at,
                metadata=row.metadata_,
            )

    @strawberry.mutation
    async def add_spans_to_dataset(
        self,
        info: Info[Context, None],
        input: AddSpansToDatasetInput,
    ) -> AddSpansToDatasetPayload:
        dataset_id = input.dataset_id
        span_ids = input.span_ids
        dataset_version_description = (
            input.dataset_version_description
            if isinstance(input.dataset_version_description, str)
            else None
        )
        dataset_version_metadata = input.dataset_version_metadata
        dataset_rowid = from_global_id_with_expected_type(
            global_id=dataset_id, expected_type_name=Dataset.__name__
        )
        span_rowids = {
            from_global_id_with_expected_type(global_id=span_id, expected_type_name=Span.__name__)
            for span_id in set(span_ids)
        }
        async with info.context.db() as session:
            if (
                dataset := await session.scalar(
                    select(models.Dataset).where(models.Dataset.id == dataset_rowid)
                )
            ) is None:
                raise ValueError(
                    f"Unknown dataset: {dataset_id}"
                )  # todo: implement error types https://github.com/Arize-ai/phoenix/issues/3221
            dataset_version_rowid = await session.scalar(
                insert(models.DatasetVersion)
                .values(
                    dataset_id=dataset_rowid,
                    description=dataset_version_description,
                    metadata_=dataset_version_metadata or {},
                )
                .returning(models.DatasetVersion.id)
            )
            spans = (
                await session.execute(
                    select(
                        models.Span.id,
                        models.Span.span_kind,
                        models.Span.attributes,
                        _span_attribute(INPUT_MIME_TYPE),
                        _span_attribute(INPUT_VALUE),
                        _span_attribute(OUTPUT_MIME_TYPE),
                        _span_attribute(OUTPUT_VALUE),
                        _span_attribute(LLM_PROMPT_TEMPLATE_VARIABLES),
                        _span_attribute(LLM_INPUT_MESSAGES),
                        _span_attribute(LLM_OUTPUT_MESSAGES),
                        _span_attribute(RETRIEVAL_DOCUMENTS),
                    )
                    .select_from(models.Span)
                    .where(models.Span.id.in_(span_rowids))
                )
            ).all()
            if missing_span_rowids := span_rowids - {span.id for span in spans}:
                raise ValueError(
                    f"Could not find spans with rowids: {', '.join(map(str, missing_span_rowids))}"
                )  # todo: implement error handling types https://github.com/Arize-ai/phoenix/issues/3221
            DatasetExample = models.DatasetExample
            dataset_example_rowids = (
                await session.scalars(
                    insert(DatasetExample).returning(DatasetExample.id),
                    [
                        {
                            DatasetExample.dataset_id.key: dataset_rowid,
                            DatasetExample.span_rowid.key: span.id,
                        }
                        for span in spans
                    ],
                )
            ).all()
            assert len(dataset_example_rowids) == len(spans)
            assert all(map(lambda id: isinstance(id, int), dataset_example_rowids))
            DatasetExampleRevision = models.DatasetExampleRevision
            await session.execute(
                insert(DatasetExampleRevision),
                [
                    {
                        DatasetExampleRevision.dataset_example_id.key: dataset_example_rowid,
                        DatasetExampleRevision.dataset_version_id.key: dataset_version_rowid,
                        DatasetExampleRevision.input.key: get_dataset_example_input(span),
                        DatasetExampleRevision.output.key: get_dataset_example_output(span),
                        DatasetExampleRevision.metadata_.key: span.attributes,
                        DatasetExampleRevision.revision_kind.key: "CREATE",
                    }
                    for dataset_example_rowid, span in zip(dataset_example_rowids, spans)
                ],
            )
        return AddSpansToDatasetPayload(
            dataset=Dataset(
                id_attr=dataset.id,
                name=dataset.name,
                description=dataset.description,
                created_at=dataset.created_at,
                updated_at=dataset.updated_at,
                metadata=dataset.metadata_,
            )
        )


@strawberry.type
class Mutation(DatasetMutation, ExportEventsMutation):
    @strawberry.mutation
    async def delete_project(self, info: Info[Context, None], id: GlobalID) -> Query:
        node_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
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
        project_id = from_global_id_with_expected_type(global_id=id, expected_type_name="Project")
        delete_statement = delete(models.Trace).where(models.Trace.project_rowid == project_id)
        async with info.context.db() as session:
            await session.execute(delete_statement)
            if cache := info.context.cache_for_dataloaders:
                cache.invalidate(ClearProjectSpansEvent(project_rowid=project_id))
        return Query()


def _span_attribute(semconv: str) -> Any:
    """
    Extracts an attribute from the ORM span attributes column and labels the
    result.

    E.g., "input.value" -> Span.attributes["input"]["value"].label("input_value")
    """
    attribute_value: Any = models.Span.attributes
    for key in semconv.split("."):
        attribute_value = attribute_value[key]
    return attribute_value.label(semconv.replace(".", "_"))


INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS


# This is the schema for generating `schema.graphql`.
# See https://strawberry.rocks/docs/guides/schema-export
# It should be kept in sync with the server's runtime-initialized
# instance. To do so, search for the usage of `strawberry.Schema(...)`.
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)
