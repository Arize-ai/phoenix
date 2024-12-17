from collections import defaultdict
from datetime import datetime
from typing import Optional, Union

import numpy as np
import numpy.typing as npt
import strawberry
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.orm import joinedload
from starlette.authentication import UnauthenticatedUser
from strawberry import ID, UNSET
from strawberry.relay import Connection, GlobalID, Node
from strawberry.types import Info
from typing_extensions import Annotated, TypeAlias

from phoenix.db import enums, models
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
from phoenix.db.models import ExperimentRun as OrmExperimentRun
from phoenix.db.models import (
    Trace as OrmTrace,
)
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.auth import MSG_ADMIN_ONLY, IsAdmin
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound, Unauthorized
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionSyntaxError,
    compile_sqlalchemy_filter_condition,
    update_examples_query_with_filter_condition,
)
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import (
    InputCoordinate2D,
    InputCoordinate3D,
)
from phoenix.server.api.input_types.DatasetSort import DatasetSort
from phoenix.server.api.input_types.InvocationParameters import (
    InvocationParameter,
)
from phoenix.server.api.subscriptions import PLAYGROUND_PROJECT_NAME
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
from phoenix.server.api.types.GenerativeModel import GenerativeModel
from phoenix.server.api.types.GenerativeProvider import (
    GenerativeProvider,
    GenerativeProviderKey,
)
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole
from phoenix.server.api.types.Model import Model
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectSession import ProjectSession, to_gql_project_session
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.SystemApiKey import SystemApiKey
from phoenix.server.api.types.Trace import to_gql_trace
from phoenix.server.api.types.User import User, to_gql_user
from phoenix.server.api.types.UserApiKey import UserApiKey, to_gql_api_key
from phoenix.server.api.types.UserRole import UserRole
from phoenix.server.api.types.ValidationResult import ValidationResult

initialize_playground_clients()


@strawberry.input
class ModelsInput:
    provider_key: Optional[GenerativeProviderKey]
    model_name: Optional[str] = None


@strawberry.type
class Query:
    @strawberry.field
    async def model_providers(self) -> list[GenerativeProvider]:
        available_providers = PLAYGROUND_CLIENT_REGISTRY.list_all_providers()
        return [
            GenerativeProvider(
                name=provider_key.value,
                key=provider_key,
            )
            for provider_key in available_providers
        ]

    @strawberry.field
    async def models(self, input: Optional[ModelsInput] = None) -> list[GenerativeModel]:
        if input is not None and input.provider_key is not None:
            supported_model_names = PLAYGROUND_CLIENT_REGISTRY.list_models(input.provider_key)
            supported_models = [
                GenerativeModel(name=model_name, provider_key=input.provider_key)
                for model_name in supported_model_names
            ]
            return supported_models

        registered_models = PLAYGROUND_CLIENT_REGISTRY.list_all_models()
        all_models: list[GenerativeModel] = []
        for provider_key, model_name in registered_models:
            if model_name is not None and provider_key is not None:
                all_models.append(GenerativeModel(name=model_name, provider_key=provider_key))
        return all_models

    @strawberry.field
    async def model_invocation_parameters(
        self, input: Optional[ModelsInput] = None
    ) -> list[InvocationParameter]:
        if input is None:
            return []
        provider_key = input.provider_key
        model_name = input.model_name
        if provider_key is not None:
            client = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, model_name)
            if client is None:
                return []
            invocation_parameters = client.supported_invocation_parameters()
            return invocation_parameters
        else:
            return []

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def users(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[User]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.User)
            .join(models.UserRole)
            .where(models.UserRole.name != enums.UserRole.SYSTEM.value)
            .order_by(models.User.email)
            .options(joinedload(models.User.role))
        )
        async with info.context.db() as session:
            users = await session.stream_scalars(stmt)
            data = [to_gql_user(user) async for user in users]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def user_roles(
        self,
        info: Info[Context, None],
    ) -> list[UserRole]:
        async with info.context.db() as session:
            roles = await session.scalars(
                select(models.UserRole).where(models.UserRole.name != enums.UserRole.SYSTEM.value)
            )
        return [
            UserRole(
                id_attr=role.id,
                name=role.name,
            )
            for role in roles
        ]

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def user_api_keys(self, info: Info[Context, None]) -> list[UserApiKey]:
        stmt = (
            select(models.ApiKey)
            .join(models.User)
            .join(models.UserRole)
            .where(models.UserRole.name != enums.UserRole.SYSTEM.value)
        )
        async with info.context.db() as session:
            api_keys = await session.scalars(stmt)
        return [to_gql_api_key(api_key) for api_key in api_keys]

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def system_api_keys(self, info: Info[Context, None]) -> list[SystemApiKey]:
        stmt = (
            select(models.ApiKey)
            .join(models.User)
            .join(models.UserRole)
            .where(models.UserRole.name == enums.UserRole.SYSTEM.value)
        )
        async with info.context.db() as session:
            api_keys = await session.scalars(stmt)
        return [
            SystemApiKey(
                id_attr=api_key.id,
                name=api_key.name,
                description=api_key.description,
                created_at=api_key.created_at,
                expires_at=api_key.expires_at,
            )
            for api_key in api_keys
        ]

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
                and_(
                    models.Project.name == models.Experiment.project_name,
                    models.Experiment.project_name != PLAYGROUND_PROJECT_NAME,
                ),
            )
            .where(models.Experiment.project_name.is_(None))
            .order_by(models.Project.id)
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
    def projects_last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Project)

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
    def datasets_last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Dataset)

    @strawberry.field
    async def compare_experiments(
        self,
        info: Info[Context, None],
        experiment_ids: list[GlobalID],
        filter_condition: Optional[str] = UNSET,
    ) -> list[ExperimentComparison]:
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
            examples_query = (
                select(OrmExample)
                .distinct(OrmExample.id)
                .join(
                    OrmRevision,
                    onclause=and_(
                        OrmExample.id == OrmRevision.dataset_example_id,
                        OrmRevision.id.in_(revision_ids),
                        OrmRevision.revision_kind != "DELETE",
                    ),
                )
                .order_by(OrmExample.id.desc())
            )

            if filter_condition:
                examples_query = update_examples_query_with_filter_condition(
                    query=examples_query,
                    filter_condition=filter_condition,
                    experiment_ids=experiment_ids_,
                )

            examples = (await session.scalars(examples_query)).all()

            ExampleID: TypeAlias = int
            ExperimentID: TypeAlias = int
            runs: defaultdict[ExampleID, defaultdict[ExperimentID, list[OrmExperimentRun]]] = (
                defaultdict(lambda: defaultdict(list))
            )
            async for run in await session.stream_scalars(
                select(OrmExperimentRun)
                .where(
                    and_(
                        OrmExperimentRun.dataset_example_id.in_(example.id for example in examples),
                        OrmExperimentRun.experiment_id.in_(experiment_ids_),
                    )
                )
                .options(joinedload(OrmExperimentRun.trace).load_only(OrmTrace.trace_id))
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
    async def validate_experiment_run_filter_condition(
        self,
        condition: str,
        experiment_ids: list[GlobalID],
    ) -> ValidationResult:
        try:
            compile_sqlalchemy_filter_condition(
                filter_condition=condition,
                experiment_ids=[
                    from_global_id_with_expected_type(experiment_id, OrmExperiment.__name__)
                    for experiment_id in experiment_ids
                ],
            )
            return ValidationResult(
                is_valid=True,
                error_message=None,
            )
        except ExperimentRunFilterConditionSyntaxError as error:
            return ValidationResult(
                is_valid=False,
                error_message=str(error),
            )

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
                raise NotFound(f"Unknown project: {id}")
            return Project(
                id_attr=project.id,
                name=project.name,
                gradient_start_color=project.gradient_start_color,
                gradient_end_color=project.gradient_end_color,
            )
        elif type_name == "Trace":
            trace_stmt = select(models.Trace).filter_by(id=node_id)
            async with info.context.db() as session:
                trace = await session.scalar(trace_stmt)
            if trace is None:
                raise NotFound(f"Unknown trace: {id}")
            return to_gql_trace(trace)
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
                raise NotFound(f"Unknown span: {id}")
            return to_gql_span(span)
        elif type_name == Dataset.__name__:
            dataset_stmt = select(models.Dataset).where(models.Dataset.id == node_id)
            async with info.context.db() as session:
                if (dataset := await session.scalar(dataset_stmt)) is None:
                    raise NotFound(f"Unknown dataset: {id}")
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
                raise NotFound(f"Unknown dataset example: {id}")
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
                raise NotFound(f"Unknown experiment: {id}")
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
                    raise NotFound(f"Unknown experiment run: {id}")
            return to_gql_experiment_run(run)
        elif type_name == User.__name__:
            if int((user := info.context.user).identity) != node_id and not user.is_admin:
                raise Unauthorized(MSG_ADMIN_ONLY)
            async with info.context.db() as session:
                if not (
                    user := await session.scalar(
                        select(models.User).where(models.User.id == node_id)
                    )
                ):
                    raise NotFound(f"Unknown user: {id}")
            return to_gql_user(user)
        elif type_name == ProjectSession.__name__:
            async with info.context.db() as session:
                if not (
                    project_session := await session.scalar(
                        select(models.ProjectSession).filter_by(id=node_id)
                    )
                ):
                    raise NotFound(f"Unknown user: {id}")
            return to_gql_project_session(project_session)
        raise NotFound(f"Unknown node type: {type_name}")

    @strawberry.field
    async def viewer(self, info: Info[Context, None]) -> Optional[User]:
        request = info.context.get_request()
        try:
            user = request.user
        except AssertionError:
            return None
        if isinstance(user, UnauthenticatedUser):
            return None
        async with info.context.db() as session:
            if (
                user := await session.scalar(
                    select(models.User)
                    .where(models.User.id == int(user.identity))
                    .options(joinedload(models.User.role))
                )
            ) is None:
                return None
        return to_gql_user(user)

    @strawberry.field
    def clusters(
        self,
        clusters: list[ClusterInput],
    ) -> list[Cluster]:
        clustered_events: dict[str, set[ID]] = defaultdict(set)
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
            list[ID],
            strawberry.argument(
                description="Event ID of the coordinates",
            ),
        ],
        coordinates_2d: Annotated[
            Optional[list[InputCoordinate2D]],
            strawberry.argument(
                description="Point coordinates. Must be either 2D or 3D.",
            ),
        ] = UNSET,
        coordinates_3d: Annotated[
            Optional[list[InputCoordinate3D]],
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
    ) -> list[Cluster]:
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

        grouped_event_ids: dict[
            Union[InferencesRole, AncillaryInferencesRole],
            list[ID],
        ] = defaultdict(list)
        grouped_coordinates: dict[
            Union[InferencesRole, AncillaryInferencesRole],
            list[npt.NDArray[np.float64]],
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
