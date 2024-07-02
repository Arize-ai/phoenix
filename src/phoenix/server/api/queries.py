from collections import defaultdict
from typing import DefaultDict, Dict, List, Optional, Set, Union

import numpy as np
import numpy.typing as npt
import strawberry
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.orm import joinedload
from strawberry import ID, UNSET
from strawberry.relay import Connection, GlobalID, Node
from strawberry.types import Info
from typing_extensions import Annotated, TypeAlias

from phoenix.db import models
from phoenix.db.models import (
    DatasetExample as OrmExample,
)
from phoenix.db.models import (
    DatasetExampleRevision as OrmRevision,
)
from phoenix.db.models import (
    DatasetVersion as OrmVersion,
)
from phoenix.db.models import (
    Experiment as OrmExperiment,
)
from phoenix.db.models import (
    ExperimentRun as OrmRun,
)
from phoenix.db.models import (
    Trace as OrmTrace,
)
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.context import Context
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import (
    InputCoordinate2D,
    InputCoordinate3D,
)
from phoenix.server.api.input_types.DatasetSort import DatasetSort
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters
from phoenix.server.api.types.Dataset import Dataset, to_gql_dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.Dimension import to_gql_dimension
from phoenix.server.api.types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from phoenix.server.api.types.Event import create_event_id, unpack_event_id
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.ExperimentComparison import ExperimentComparison, RunComparisonItem
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
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
from phoenix.server.api.types.SortDir import SortDir
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
        stmt = (
            select(models.Project)
            .outerjoin(
                models.Experiment,
                models.Project.name == models.Experiment.project_name,
            )
            .where(models.Experiment.project_name.is_(None))
        )
        async with info.context.db() as session:
            projects = await session.stream_scalars(stmt)
            data = [
                Project(
                    id_attr=project.id,
                    name=project.name,
                    gradient_start_color=project.gradient_start_color,
                    gradient_end_color=project.gradient_end_color,
                )
                async for project in projects
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
        sort: Optional[DatasetSort] = UNSET,
    ) -> Connection[Dataset]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.Dataset)
        if sort:
            sort_col = getattr(models.Dataset, sort.col.value)
            stmt = stmt.order_by(sort_col.desc() if sort.dir is SortDir.desc else sort_col.asc())
        async with info.context.db() as session:
            datasets = await session.scalars(stmt)
        return connection_from_list(
            data=[to_gql_dataset(dataset) for dataset in datasets], args=args
        )

    @strawberry.field
    async def compare_experiments(
        self,
        info: Info[Context, None],
        experiment_ids: List[GlobalID],
    ) -> List[ExperimentComparison]:
        experiment_ids_ = [
            from_global_id_with_expected_type(experiment_id, OrmExperiment.__name__)
            for experiment_id in experiment_ids
        ]
        if len(set(experiment_ids_)) != len(experiment_ids_):
            raise ValueError("Experiment IDs must be unique.")

        async with info.context.db() as session:
            validation_result = (
                await session.execute(
                    select(
                        func.count(distinct(OrmVersion.dataset_id)),
                        func.max(OrmVersion.dataset_id),
                        func.max(OrmVersion.id),
                        func.count(OrmExperiment.id),
                    )
                    .select_from(OrmVersion)
                    .join(
                        OrmExperiment,
                        OrmExperiment.dataset_version_id == OrmVersion.id,
                    )
                    .where(
                        OrmExperiment.id.in_(experiment_ids_),
                    )
                )
            ).first()
            if validation_result is None:
                raise ValueError("No experiments could be found for input IDs.")

            num_datasets, dataset_id, version_id, num_resolved_experiment_ids = validation_result
            if num_datasets != 1:
                raise ValueError("Experiments must belong to the same dataset.")
            if num_resolved_experiment_ids != len(experiment_ids_):
                raise ValueError("Unable to resolve one or more experiment IDs.")

            revision_ids = (
                select(func.max(OrmRevision.id))
                .join(OrmExample, OrmExample.id == OrmRevision.dataset_example_id)
                .where(
                    and_(
                        OrmRevision.dataset_version_id <= version_id,
                        OrmExample.dataset_id == dataset_id,
                    )
                )
                .group_by(OrmRevision.dataset_example_id)
                .scalar_subquery()
            )
            examples = (
                await session.scalars(
                    select(OrmExample)
                    .join(OrmRevision, OrmExample.id == OrmRevision.dataset_example_id)
                    .where(
                        and_(
                            OrmRevision.id.in_(revision_ids),
                            OrmRevision.revision_kind != "DELETE",
                        )
                    )
                    .order_by(OrmRevision.dataset_example_id.desc())
                )
            ).all()

            ExampleID: TypeAlias = int
            ExperimentID: TypeAlias = int
            runs: DefaultDict[ExampleID, DefaultDict[ExperimentID, List[OrmRun]]] = defaultdict(
                lambda: defaultdict(list)
            )
            async for run in await session.stream_scalars(
                select(OrmRun)
                .where(
                    and_(
                        OrmRun.dataset_example_id.in_(example.id for example in examples),
                        OrmRun.experiment_id.in_(experiment_ids_),
                    )
                )
                .options(joinedload(OrmRun.trace).load_only(OrmTrace.trace_id))
            ):
                runs[run.dataset_example_id][run.experiment_id].append(run)

        experiment_comparisons = []
        for example in examples:
            run_comparison_items = []
            for experiment_id in experiment_ids_:
                run_comparison_items.append(
                    RunComparisonItem(
                        experiment_id=GlobalID(Experiment.__name__, str(experiment_id)),
                        runs=[
                            to_gql_experiment_run(run)
                            for run in sorted(
                                runs[example.id][experiment_id], key=lambda run: run.id
                            )
                        ],
                    )
                )
            experiment_comparisons.append(
                ExperimentComparison(
                    example=DatasetExample(
                        id_attr=example.id,
                        created_at=example.created_at,
                        version_id=version_id,
                    ),
                    run_comparison_items=run_comparison_items,
                )
            )
        return experiment_comparisons

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
            trace_stmt = select(
                models.Trace.id,
                models.Trace.project_rowid,
            ).where(models.Trace.id == node_id)
            async with info.context.db() as session:
                trace = (await session.execute(trace_stmt)).first()
            if trace is None:
                raise ValueError(f"Unknown trace: {id}")
            return Trace(
                id_attr=trace.id, trace_id=trace.trace_id, project_rowid=trace.project_rowid
            )
        elif type_name == Span.__name__:
            span_stmt = (
                select(models.Span)
                .options(
                    joinedload(models.Span.trace, innerjoin=True).load_only(models.Trace.trace_id)
                )
                .where(models.Span.id == node_id)
            )
            async with info.context.db() as session:
                span = await session.scalar(span_stmt)
            if span is None:
                raise ValueError(f"Unknown span: {id}")
            return to_gql_span(span)
        elif type_name == Dataset.__name__:
            dataset_stmt = select(models.Dataset).where(models.Dataset.id == node_id)
            async with info.context.db() as session:
                if (dataset := await session.scalar(dataset_stmt)) is None:
                    raise ValueError(f"Unknown dataset: {id}")
            return to_gql_dataset(dataset)
        elif type_name == DatasetExample.__name__:
            example_id = node_id
            latest_revision_id = (
                select(func.max(models.DatasetExampleRevision.id))
                .where(models.DatasetExampleRevision.dataset_example_id == example_id)
                .scalar_subquery()
            )
            async with info.context.db() as session:
                example = await session.scalar(
                    select(models.DatasetExample)
                    .join(
                        models.DatasetExampleRevision,
                        onclause=models.DatasetExampleRevision.dataset_example_id
                        == models.DatasetExample.id,
                    )
                    .where(
                        and_(
                            models.DatasetExample.id == example_id,
                            models.DatasetExampleRevision.id == latest_revision_id,
                            models.DatasetExampleRevision.revision_kind != "DELETE",
                        )
                    )
                )
            if not example:
                raise ValueError(f"Unknown dataset example: {id}")
            return DatasetExample(
                id_attr=example.id,
                created_at=example.created_at,
            )
        elif type_name == Experiment.__name__:
            async with info.context.db() as session:
                experiment = await session.scalar(
                    select(models.Experiment).where(models.Experiment.id == node_id)
                )
            if not experiment:
                raise ValueError(f"Unknown experiment: {id}")
            return Experiment(
                id_attr=experiment.id,
                name=experiment.name,
                project_name=experiment.project_name,
                description=experiment.description,
                created_at=experiment.created_at,
                updated_at=experiment.updated_at,
                metadata=experiment.metadata_,
            )
        elif type_name == ExperimentRun.__name__:
            async with info.context.db() as session:
                if not (
                    run := await session.scalar(
                        select(models.ExperimentRun)
                        .where(models.ExperimentRun.id == node_id)
                        .options(
                            joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id)
                        )
                    )
                ):
                    raise ValueError(f"Unknown experiment run: {id}")
            return to_gql_experiment_run(run)
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
