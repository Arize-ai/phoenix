from collections import defaultdict
from datetime import datetime
from itertools import chain
from typing import Dict, List, Optional, Set, Tuple, Union, cast

import numpy as np
import numpy.typing as npt
import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core.project import DEFAULT_PROJECT_NAME
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import (
    InputCoordinate2D,
    InputCoordinate3D,
)
from phoenix.server.api.input_types.SpanSort import SpanSort
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters
from phoenix.server.api.types.Project import Project
from phoenix.trace.dsl import SpanFilter
from phoenix.trace.schemas import SpanID, TraceID

from .context import Context
from .input_types.TimeRange import TimeRange
from .types.DatasetInfo import TraceDatasetInfo
from .types.DatasetRole import AncillaryDatasetRole, DatasetRole
from .types.Dimension import to_gql_dimension
from .types.DocumentEvaluationSummary import DocumentEvaluationSummary
from .types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from .types.EvaluationSummary import EvaluationSummary
from .types.Event import create_event_id, unpack_event_id
from .types.ExportEventsMutation import ExportEventsMutation
from .types.Functionality import Functionality
from .types.Model import Model
from .types.node import GlobalID, Node, from_global_id
from .types.pagination import Connection, ConnectionArgs, Cursor, connection_from_list
from .types.Span import Span, to_gql_span
from .types.ValidationResult import ValidationResult


@strawberry.type
class Query:
    @strawberry.field
    def projects(
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
        data = (
            []
            if (traces := info.context.traces) is None
            else [
                Project(id_attr=i, name=name, project=project)
                for i, (name, project) in enumerate(traces.get_projects())
            ]
        )
        return connection_from_list(data=data, args=args)

    @strawberry.field
    def functionality(self, info: Info[Context, None]) -> "Functionality":
        has_model_inferences = not info.context.model.is_empty
        has_traces = info.context.traces is not None
        return Functionality(
            model_inferences=has_model_inferences,
            tracing=has_traces,
        )

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
        elif type_name == "Project":
            if (traces := info.context.traces) is not None:
                projects = dict(enumerate(traces.get_projects()))
                if (project_item := projects.get(node_id)) is not None:
                    (name, project) = project_item
                    return Project(id_attr=node_id, name=name, project=project)
            raise Exception(f"Unknown project: {id}")

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

    @strawberry.field
    def streaming_last_updated_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        last_updated_at: Optional[datetime] = None
        if (traces := info.context.traces) is not None and (
            traces_last_updated_at := traces.last_updated_at
        ) is not None:
            last_updated_at = (
                traces_last_updated_at
                if last_updated_at is None
                else max(last_updated_at, traces_last_updated_at)
            )
        return last_updated_at

    @strawberry.field
    def spans(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        trace_ids: Optional[List[ID]] = UNSET,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
        sort: Optional[SpanSort] = UNSET,
        root_spans_only: Optional[bool] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        if not (traces := info.context.traces) or not (
            project := traces.get_project(DEFAULT_PROJECT_NAME)
        ):
            return connection_from_list(data=[], args=args)
        predicate = (
            SpanFilter(
                condition=filter_condition,
                evals=project,
            )
            if filter_condition
            else None
        )
        if not trace_ids:
            spans = traces.get_spans(
                start_time=time_range.start if time_range else None,
                stop_time=time_range.end if time_range else None,
                root_spans_only=root_spans_only,
            )
        else:
            spans = chain.from_iterable(
                traces.get_trace(trace_id) for trace_id in map(TraceID, trace_ids)
            )
        if predicate:
            spans = filter(predicate, spans)
        if sort:
            spans = sort(spans, evals=project)
        data = list(map(to_gql_span, spans))
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="Names of all available evaluations for spans. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    def span_evaluation_names(
        self,
        info: Info[Context, None],
    ) -> List[str]:
        if not (traces := info.context.traces) or not (
            project := traces.get_project(DEFAULT_PROJECT_NAME)
        ):
            return []
        return project.get_span_evaluation_names()

    @strawberry.field(
        description="Names of available document evaluations.",
    )  # type: ignore
    def document_evaluation_names(
        self,
        info: Info[Context, None],
        span_id: Optional[ID] = UNSET,
    ) -> List[str]:
        if not (traces := info.context.traces) or not (
            project := traces.get_project(DEFAULT_PROJECT_NAME)
        ):
            return []
        return project.get_document_evaluation_names(
            None if span_id is UNSET else SpanID(span_id),
        )

    @strawberry.field
    def span_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[EvaluationSummary]:
        if not (traces := info.context.traces) or not (
            project := traces.get_project(DEFAULT_PROJECT_NAME)
        ):
            return None
        predicate = (
            SpanFilter(
                condition=filter_condition,
                evals=project,
            )
            if filter_condition
            else None
        )
        span_ids = project.get_span_evaluation_span_ids(evaluation_name)
        if not span_ids:
            return None
        spans = traces.get_spans(
            start_time=time_range.start if time_range else None,
            stop_time=time_range.end if time_range else None,
            span_ids=span_ids,
        )
        if predicate:
            spans = filter(predicate, spans)
        evaluations = tuple(
            evaluation
            for span in spans
            if (
                evaluation := project.get_span_evaluation(
                    span.context.span_id,
                    evaluation_name,
                )
            )
            is not None
        )
        if not evaluations:
            return None
        labels = project.get_span_evaluation_labels(evaluation_name)
        return EvaluationSummary(evaluations, labels)

    @strawberry.field
    def document_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[DocumentEvaluationSummary]:
        if not (traces := info.context.traces) or not (
            project := traces.get_project(DEFAULT_PROJECT_NAME)
        ):
            return None
        predicate = (
            SpanFilter(condition=filter_condition, evals=project) if filter_condition else None
        )
        span_ids = project.get_document_evaluation_span_ids(evaluation_name)
        if not span_ids:
            return None
        spans = traces.get_spans(
            start_time=time_range.start if time_range else None,
            stop_time=time_range.end if time_range else None,
            span_ids=span_ids,
        )
        if predicate:
            spans = filter(predicate, spans)
        metrics_collection = []
        for span in spans:
            span_id = span.context.span_id
            num_documents = traces.get_num_documents(span_id)
            if not num_documents:
                continue
            evaluation_scores = project.get_document_evaluation_scores(
                span_id=span_id,
                evaluation_name=evaluation_name,
                num_documents=num_documents,
            )
            metrics_collection.append(RetrievalMetrics(evaluation_scores))
        if not metrics_collection:
            return None
        return DocumentEvaluationSummary(
            evaluation_name=evaluation_name,
            metrics_collection=metrics_collection,
        )

    @strawberry.field
    def trace_dataset_info(
        self,
        info: Info[Context, None],
    ) -> Optional[TraceDatasetInfo]:
        if (traces := info.context.traces) is None:
            return None
        if not (span_count := traces.span_count):
            return None
        start_time, stop_time = cast(
            Tuple[datetime, datetime],
            traces.right_open_time_range,
        )
        latency_ms_p50, latency_ms_p99 = traces.root_span_latency_ms_quantiles(0.50, 0.99)
        return TraceDatasetInfo(
            start_time=start_time,
            end_time=stop_time,
            record_count=span_count,
            token_count_total=traces.token_count_total,
            latency_ms_p50=latency_ms_p50,
            latency_ms_p99=latency_ms_p99,
        )

    @strawberry.field
    def validate_span_filter_condition(
        self, info: Info[Context, None], condition: str
    ) -> ValidationResult:
        traces = info.context.traces
        project = traces.get_project(DEFAULT_PROJECT_NAME) if traces else None
        valid_eval_names = project.get_span_evaluation_names() if project else ()
        try:
            SpanFilter(
                condition=condition,
                evals=project,
                valid_eval_names=valid_eval_names,
            )
            return ValidationResult(is_valid=True, error_message=None)
        except SyntaxError as e:
            return ValidationResult(
                is_valid=False,
                error_message=e.msg,
            )


@strawberry.type
class Mutation(ExportEventsMutation): ...


schema = strawberry.Schema(query=Query, mutation=Mutation)
