import re
from collections import defaultdict
from datetime import datetime
from typing import Iterable, Iterator, Optional, Union, cast

import numpy as np
import numpy.typing as npt
import strawberry
from sqlalchemy import and_, distinct, func, select, text
from sqlalchemy.orm import joinedload
from starlette.authentication import UnauthenticatedUser
from strawberry import ID, UNSET
from strawberry.relay import Connection, GlobalID, Node
from strawberry.types import Info
from typing_extensions import Annotated, TypeAlias, assert_never

from phoenix.config import (
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    get_env_database_allocated_storage_capacity_gibibytes,
    getenv,
)
from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.helpers import SupportedSQLDialect, exclude_experiment_projects
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.auth import MSG_ADMIN_ONLY, IsAdmin
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionSyntaxError,
    compile_sqlalchemy_filter_condition,
    update_examples_query_with_filter_condition,
)
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import InputCoordinate2D, InputCoordinate3D
from phoenix.server.api.input_types.DatasetFilter import DatasetFilter
from phoenix.server.api.input_types.DatasetSort import DatasetSort
from phoenix.server.api.input_types.InvocationParameters import InvocationParameter
from phoenix.server.api.input_types.ProjectFilter import ProjectFilter
from phoenix.server.api.input_types.ProjectSort import ProjectColumn, ProjectSort
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
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
from phoenix.server.api.types.GenerativeModel import GenerativeModel, to_gql_generative_model
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.server.api.types.InferenceModel import InferenceModel
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.PlaygroundModel import PlaygroundModel
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectSession import ProjectSession, to_gql_project_session
from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt_from_orm
from phoenix.server.api.types.PromptLabel import PromptLabel, to_gql_prompt_label
from phoenix.server.api.types.PromptVersion import PromptVersion, to_gql_prompt_version
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag, to_gql_prompt_version_tag
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation
from phoenix.server.api.types.SystemApiKey import SystemApiKey
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation, to_gql_trace_annotation
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
class DbTableStats:
    table_name: str
    num_bytes: float


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
    async def generative_models(
        self,
        info: Info[Context, None],
    ) -> list[GenerativeModel]:
        async with info.context.db() as session:
            result = await session.scalars(
                select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.is_(None))
                .order_by(
                    models.GenerativeModel.is_built_in.asc(),  # display custom models first
                    models.GenerativeModel.provider.nullslast(),
                    models.GenerativeModel.name,
                )
                .options(joinedload(models.GenerativeModel.token_prices))
            )

        return [to_gql_generative_model(model) for model in result.unique()]

    @strawberry.field
    async def playground_models(self, input: Optional[ModelsInput] = None) -> list[PlaygroundModel]:
        if input is not None and input.provider_key is not None:
            supported_model_names = PLAYGROUND_CLIENT_REGISTRY.list_models(input.provider_key)
            supported_models = [
                PlaygroundModel(name=model_name, provider_key=input.provider_key)
                for model_name in supported_model_names
            ]
            return supported_models

        registered_models = PLAYGROUND_CLIENT_REGISTRY.list_all_models()
        all_models: list[PlaygroundModel] = []
        for provider_key, model_name in registered_models:
            if model_name is not None and provider_key is not None:
                all_models.append(PlaygroundModel(name=model_name, provider_key=provider_key))
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
            .where(models.UserRole.name != "SYSTEM")
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
                select(models.UserRole).where(models.UserRole.name != "SYSTEM")
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
            .where(models.UserRole.name != "SYSTEM")
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
            .where(models.UserRole.name == "SYSTEM")
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
        sort: Optional[ProjectSort] = UNSET,
        filter: Optional[ProjectFilter] = UNSET,
    ) -> Connection[Project]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.Project)

        if sort and sort.col is ProjectColumn.endTime:
            # For end time sorting, we need to use a correlated subquery
            # The end_time comes from the Trace model, and we need to get the max end_time for
            # each project
            end_time_subq = (
                select(func.max(models.Trace.end_time))
                .where(models.Trace.project_rowid == models.Project.id)
                .scalar_subquery()
            )
            stmt = stmt.order_by(
                end_time_subq.desc() if sort.dir is SortDir.desc else end_time_subq.asc()
            )
        elif sort:
            sort_col = getattr(models.Project, sort.col.value)
            stmt = stmt.order_by(sort_col.desc() if sort.dir is SortDir.desc else sort_col.asc())
        if filter:
            stmt = stmt.where(getattr(models.Project, filter.col.value).ilike(f"%{filter.value}%"))
        stmt = exclude_experiment_projects(stmt)
        async with info.context.db() as session:
            projects = await session.stream_scalars(stmt)
            data = [
                Project(
                    project_rowid=project.id,
                    db_project=project,
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
        filter: Optional[DatasetFilter] = UNSET,
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
        if filter:
            stmt = stmt.where(getattr(models.Dataset, filter.col.value).ilike(f"%{filter.value}%"))
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
        baseline_experiment_id: GlobalID,
        compare_experiment_ids: list[GlobalID],
        first: Optional[int] = 50,
        after: Optional[CursorString] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Connection[ExperimentComparison]:
        if baseline_experiment_id in compare_experiment_ids:
            raise BadRequest("Compare experiment IDs cannot contain the baseline experiment ID")
        if len(set(compare_experiment_ids)) < len(compare_experiment_ids):
            raise BadRequest("Compare experiment IDs must be unique")
        experiment_ids = [
            from_global_id_with_expected_type(experiment_id, models.Experiment.__name__)
            for experiment_id in (baseline_experiment_id, *compare_experiment_ids)
        ]
        cursor = Cursor.from_string(after) if after else None
        page_size = first or 50

        async with info.context.db() as session:
            validation_result = (
                await session.execute(
                    select(
                        func.count(distinct(models.DatasetVersion.dataset_id)),
                        func.max(models.DatasetVersion.dataset_id),
                        func.max(models.DatasetVersion.id),
                        func.count(models.Experiment.id),
                    )
                    .select_from(models.DatasetVersion)
                    .join(
                        models.Experiment,
                        models.Experiment.dataset_version_id == models.DatasetVersion.id,
                    )
                    .where(
                        models.Experiment.id.in_(experiment_ids),
                    )
                )
            ).first()
            if validation_result is None:
                raise NotFound("No experiments could be found for input IDs.")

            num_datasets, dataset_id, version_id, num_resolved_experiment_ids = validation_result
            if num_datasets != 1:
                raise BadRequest("Experiments must belong to the same dataset.")
            if num_resolved_experiment_ids != len(experiment_ids):
                raise NotFound("Unable to resolve one or more experiment IDs.")

            revision_ids = (
                select(func.max(models.DatasetExampleRevision.id))
                .join(
                    models.DatasetExample,
                    models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id,
                )
                .where(
                    and_(
                        models.DatasetExampleRevision.dataset_version_id <= version_id,
                        models.DatasetExample.dataset_id == dataset_id,
                    )
                )
                .group_by(models.DatasetExampleRevision.dataset_example_id)
                .scalar_subquery()
            )
            examples_query = (
                select(models.DatasetExample)
                .distinct(models.DatasetExample.id)
                .join(
                    models.DatasetExampleRevision,
                    onclause=and_(
                        models.DatasetExample.id
                        == models.DatasetExampleRevision.dataset_example_id,
                        models.DatasetExampleRevision.id.in_(revision_ids),
                        models.DatasetExampleRevision.revision_kind != "DELETE",
                    ),
                )
                .order_by(models.DatasetExample.id.desc())
                .limit(page_size + 1)
            )
            if cursor is not None:
                examples_query = examples_query.where(models.DatasetExample.id < cursor.rowid)

            if filter_condition:
                examples_query = update_examples_query_with_filter_condition(
                    query=examples_query,
                    filter_condition=filter_condition,
                    experiment_ids=experiment_ids,
                )

            examples = (await session.scalars(examples_query)).all()
            has_next_page = len(examples) > page_size
            examples = examples[:page_size]

            ExampleID: TypeAlias = int
            ExperimentID: TypeAlias = int
            runs: defaultdict[ExampleID, defaultdict[ExperimentID, list[models.ExperimentRun]]] = (
                defaultdict(lambda: defaultdict(list))
            )
            async for run in await session.stream_scalars(
                select(models.ExperimentRun)
                .where(
                    and_(
                        models.ExperimentRun.dataset_example_id.in_(
                            example.id for example in examples
                        ),
                        models.ExperimentRun.experiment_id.in_(experiment_ids),
                    )
                )
                .options(joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id))
                .order_by(
                    models.ExperimentRun.repetition_number.asc()
                )  # repetitions are not currently implemented, but this ensures that the repetitions will be properly ordered once implemented # noqa: E501
            ):
                runs[run.dataset_example_id][run.experiment_id].append(run)

        cursors_and_nodes = []
        for example in examples:
            run_comparison_items = []
            for experiment_id in experiment_ids:
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
            experiment_comparison = ExperimentComparison(
                id_attr=example.id,
                example=DatasetExample(
                    id_attr=example.id,
                    created_at=example.created_at,
                    version_id=version_id,
                ),
                run_comparison_items=run_comparison_items,
            )
            cursors_and_nodes.append((Cursor(rowid=example.id), experiment_comparison))

        return connection_from_cursors_and_nodes(
            cursors_and_nodes=cursors_and_nodes,
            has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
            has_next_page=has_next_page,
        )

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
                    from_global_id_with_expected_type(experiment_id, models.Experiment.__name__)
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
        return Functionality(
            model_inferences=has_model_inferences,
        )

    @strawberry.field
    def model(self) -> InferenceModel:
        return InferenceModel()

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
            project_stmt = select(models.Project).filter_by(id=node_id)
            async with info.context.db() as session:
                project = await session.scalar(project_stmt)
            if project is None:
                raise NotFound(f"Unknown project: {id}")
            return Project(
                project_rowid=project.id,
                db_project=project,
            )
        elif type_name == "Trace":
            trace_stmt = select(models.Trace).filter_by(id=node_id)
            async with info.context.db() as session:
                trace = await session.scalar(trace_stmt)
            if trace is None:
                raise NotFound(f"Unknown trace: {id}")
            return Trace(trace_rowid=trace.id, db_trace=trace)
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
            return Span(span_rowid=span.id, db_span=span)
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
        elif type_name == Prompt.__name__:
            async with info.context.db() as session:
                if orm_prompt := await session.scalar(
                    select(models.Prompt).where(models.Prompt.id == node_id)
                ):
                    return to_gql_prompt_from_orm(orm_prompt)
                else:
                    raise NotFound(f"Unknown prompt: {id}")
        elif type_name == PromptVersion.__name__:
            async with info.context.db() as session:
                if orm_prompt_version := await session.scalar(
                    select(models.PromptVersion).where(models.PromptVersion.id == node_id)
                ):
                    return to_gql_prompt_version(orm_prompt_version)
                else:
                    raise NotFound(f"Unknown prompt version: {id}")
        elif type_name == PromptLabel.__name__:
            async with info.context.db() as session:
                if not (
                    prompt_label := await session.scalar(
                        select(models.PromptLabel).where(models.PromptLabel.id == node_id)
                    )
                ):
                    raise NotFound(f"Unknown prompt label: {id}")
            return to_gql_prompt_label(prompt_label)
        elif type_name == PromptVersionTag.__name__:
            async with info.context.db() as session:
                if not (prompt_version_tag := await session.get(models.PromptVersionTag, node_id)):
                    raise NotFound(f"Unknown prompt version tag: {id}")
            return to_gql_prompt_version_tag(prompt_version_tag)
        elif type_name == ProjectTraceRetentionPolicy.__name__:
            async with info.context.db() as session:
                db_policy = await session.scalar(
                    select(models.ProjectTraceRetentionPolicy).filter_by(id=node_id)
                )
                if not db_policy:
                    raise NotFound(f"Unknown project trace retention policy: {id}")
            return ProjectTraceRetentionPolicy(id=db_policy.id, db_policy=db_policy)
        elif type_name == SpanAnnotation.__name__:
            async with info.context.db() as session:
                span_annotation = await session.get(models.SpanAnnotation, node_id)
                if not span_annotation:
                    raise NotFound(f"Unknown span annotation: {id}")
            return to_gql_span_annotation(span_annotation)
        elif type_name == TraceAnnotation.__name__:
            async with info.context.db() as session:
                trace_annotation = await session.get(models.TraceAnnotation, node_id)
                if not trace_annotation:
                    raise NotFound(f"Unknown trace annotation: {id}")
            return to_gql_trace_annotation(trace_annotation)
        elif type_name == GenerativeModel.__name__:
            async with info.context.db() as session:
                stmt = (
                    select(models.GenerativeModel)
                    .where(models.GenerativeModel.deleted_at.is_(None))
                    .where(models.GenerativeModel.id == node_id)
                    .options(joinedload(models.GenerativeModel.token_prices))
                )
                model = await session.scalar(stmt)
                if not model:
                    raise NotFound(f"Unknown model: {id}")
            return to_gql_generative_model(model)
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
    async def prompts(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Prompt]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.Prompt)
        async with info.context.db() as session:
            orm_prompts = await session.stream_scalars(stmt)
            data = [to_gql_prompt_from_orm(orm_prompt) async for orm_prompt in orm_prompts]
            return connection_from_list(
                data=data,
                args=args,
            )

    @strawberry.field
    async def prompt_labels(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[PromptLabel]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            prompt_labels = await session.stream_scalars(select(models.PromptLabel))
            data = [to_gql_prompt_label(prompt_label) async for prompt_label in prompt_labels]
            return connection_from_list(
                data=data,
                args=args,
            )

    @strawberry.field
    async def annotation_configs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
    ) -> Connection[AnnotationConfig]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            configs = await session.stream_scalars(
                select(models.AnnotationConfig).order_by(models.AnnotationConfig.name)
            )
            data = [to_gql_annotation_config(config) async for config in configs]
            return connection_from_list(data=data, args=args)

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

    @strawberry.field
    async def default_project_trace_retention_policy(
        self,
        info: Info[Context, None],
    ) -> ProjectTraceRetentionPolicy:
        stmt = select(models.ProjectTraceRetentionPolicy).filter_by(
            id=DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
        )
        async with info.context.db() as session:
            db_policy = await session.scalar(stmt)
        assert db_policy
        return ProjectTraceRetentionPolicy(id=db_policy.id, db_policy=db_policy)

    @strawberry.field
    async def project_trace_retention_policies(
        self,
        info: Info[Context, None],
        first: Optional[int] = 100,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[ProjectTraceRetentionPolicy]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.ProjectTraceRetentionPolicy).order_by(
            models.ProjectTraceRetentionPolicy.id
        )
        async with info.context.db() as session:
            result = await session.stream_scalars(stmt)
            data = [
                ProjectTraceRetentionPolicy(id=db_policy.id, db_policy=db_policy)
                async for db_policy in result
            ]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="The allocated storage capacity of the database in bytes. "
        "Return None if this information is unavailable.",
    )  # type: ignore
    async def db_storage_capacity_bytes(self) -> Optional[float]:
        if gibibytes := get_env_database_allocated_storage_capacity_gibibytes():
            return gibibytes * 2**30
        return None

    @strawberry.field
    async def db_table_stats(
        self,
        info: Info[Context, None],
    ) -> list[DbTableStats]:
        if info.context.db.dialect is SupportedSQLDialect.SQLITE:
            # TODO: temporary workaround until we can figure out why
            # the dbstat query takes longer than expected
            async with info.context.db() as session:
                page_count = await session.scalar(text("PRAGMA page_count;"))
                free_pages = await session.scalar(text("PRAGMA freelist_count;"))
                page_size = await session.scalar(text("PRAGMA page_size;"))
            num_bytes = (page_count - free_pages) * page_size
            return [DbTableStats(table_name="SQLite", num_bytes=num_bytes)]
            # stmt = text("SELECT name, sum(pgsize) FROM dbstat group by name;")
            # async with info.context.db() as session:
            #     stats = cast(Iterable[tuple[str, int]], await session.execute(stmt))
            # stats = _consolidate_sqlite_db_table_stats(stats)
        elif info.context.db.dialect is SupportedSQLDialect.POSTGRESQL:
            nspname = getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA) or "public"
            stmt = text("""\
                SELECT c.relname, pg_total_relation_size(c.oid)
                FROM pg_class as c
                INNER JOIN pg_namespace as n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r'
                AND n.nspname = :nspname;
            """).bindparams(nspname=nspname)
            try:
                async with info.context.db() as session:
                    stats = cast(Iterable[tuple[str, int]], await session.execute(stmt))
            except Exception:
                # TODO: temporary workaround until we can reproduce the error
                return []
        else:
            assert_never(info.context.db.dialect)
        return [
            DbTableStats(table_name=table_name, num_bytes=num_bytes)
            for table_name, num_bytes in stats
        ]

    @strawberry.field
    def validate_regular_expression(self, regex: str) -> ValidationResult:
        try:
            re.compile(regex)
            return ValidationResult(is_valid=True, error_message=None)
        except re.error as error:
            return ValidationResult(is_valid=False, error_message=str(error))

    @strawberry.field
    async def get_span_by_otel_id(
        self,
        info: Info[Context, None],
        span_id: str,
    ) -> Optional[Span]:
        stmt = select(models.Span.id).filter_by(span_id=span_id)
        async with info.context.db() as session:
            span_rowid = await session.scalar(stmt)
        if span_rowid:
            return Span(span_rowid=span_rowid)
        return None

    @strawberry.field
    async def get_trace_by_otel_id(
        self,
        info: Info[Context, None],
        trace_id: str,
    ) -> Optional[Trace]:
        stmt = select(models.Trace.id).where(models.Trace.trace_id == trace_id)
        async with info.context.db() as session:
            trace_rowid = await session.scalar(stmt)
        if trace_rowid:
            return Trace(trace_rowid=trace_rowid)
        return None

    @strawberry.field
    async def get_project_session_by_otel_id(
        self,
        info: Info[Context, None],
        session_id: str,
    ) -> Optional[ProjectSession]:
        stmt = select(models.ProjectSession).where(models.ProjectSession.session_id == session_id)
        async with info.context.db() as session:
            session_row = await session.scalar(stmt)
        if session_row:
            return to_gql_project_session(session_row)
        return None


def _consolidate_sqlite_db_table_stats(
    stats: Iterable[tuple[str, int]],
) -> Iterator[tuple[str, int]]:
    """
    Consolidate SQLite database stats by combining indexes with their respective tables.
    """
    aggregate: dict[str, int] = {}
    for name, num_bytes in stats:
        # Skip internal SQLite tables and indexes.
        if name.startswith("ix_") or name.startswith("sqlite_"):
            continue
        aggregate[name] = num_bytes
    for name, num_bytes in stats:
        # Combine indexes with their respective tables.
        for flag in ["sqlite_autoindex_", "ix_"]:
            if not name.startswith(flag):
                continue
            if parent := _longest_matching_prefix(name[len(flag) :], aggregate.keys()):
                aggregate[parent] += num_bytes
            break
    yield from aggregate.items()


def _longest_matching_prefix(s: str, prefixes: Iterable[str]) -> str:
    """
    Return the longest prefix of s that matches any of the given prefixes.
    """
    longest = ""
    for prefix in prefixes:
        if s.startswith(prefix) and len(prefix) > len(longest):
            longest = prefix
    return longest
