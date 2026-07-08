import json
import re
from collections import defaultdict
from datetime import datetime
from typing import Annotated, Any, Iterable, Iterator, Literal, Optional
from typing import cast as type_cast

import strawberry
from sqlalchemy import ColumnElement, String, and_, case, cast, exists, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only, with_polymorphic
from starlette.authentication import UnauthenticatedUser
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.config import (
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    get_env_database_allocated_storage_capacity_gibibytes,
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_collector_endpoint,
    get_env_phoenix_agents_web_access_enabled,
    getenv,
)
from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.helpers import (
    SupportedSQLDialect,
    exclude_dataset_evaluator_projects,
    exclude_experiment_projects,
)
from phoenix.db.models import LatencyMs
from phoenix.db.types.annotation_configs import OptimizationDirection
from phoenix.db.types.prompts import PromptMessageRole
from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
    SubjectKind,
)
from phoenix.server.api.auth import MSG_ADMIN_ONLY, IsAdmin, IsAdminIfAuthEnabled
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    apply_input_mapping,
    cast_template_variable_types,
    infer_input_schema_from_template,
    validate_template_variables,
)
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers.classification_evaluator_configs import (
    get_classification_evaluator_configs,
)
from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionSyntaxError,
    compile_sqlalchemy_filter_condition,
    update_examples_query_with_filter_condition,
)
from phoenix.server.api.helpers.playground_clients import (
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.helpers.prompts.template_helpers import get_template_formatter
from phoenix.server.api.input_types.AvailableAgentSkillsInput import AvailableAgentSkillsInput
from phoenix.server.api.input_types.DatasetFilter import DatasetFilter
from phoenix.server.api.input_types.DatasetSort import DatasetSort
from phoenix.server.api.input_types.EvaluatorFilter import EvaluatorFilter
from phoenix.server.api.input_types.EvaluatorSort import EvaluatorSort
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.ProjectFilter import ProjectFilter
from phoenix.server.api.input_types.ProjectSort import ProjectColumn, ProjectSort
from phoenix.server.api.input_types.PromptFilter import PromptFilter
from phoenix.server.api.input_types.PromptTemplateOptions import PromptTemplateOptions
from phoenix.server.api.input_types.PromptVersionInput import PromptChatTemplateInput
from phoenix.server.api.input_types.UserFilter import UserFilter
from phoenix.server.api.types.AccessObjectType import AccessObjectType
from phoenix.server.api.types.AgentsConfig import AgentsConfig
from phoenix.server.api.types.AgentSkill import AgentSkill
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
from phoenix.server.api.types.ClassificationEvaluatorConfig import ClassificationEvaluatorConfig
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetLabel import DatasetLabel
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    CodeEvaluator,
    DatasetEvaluator,
    Evaluator,
    LLMEvaluator,
)
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.ExperimentComparison import (
    ExperimentComparison,
)
from phoenix.server.api.types.ExperimentJob import ExperimentJob
from phoenix.server.api.types.ExperimentRepeatedRunGroup import (
    ExperimentRepeatedRunGroup,
    parse_experiment_repeated_run_group_node_id,
)
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.GenerativeModel import GenerativeModel
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.server.api.types.node import (
    from_global_id_with_expected_type,
    is_composite_global_id,
)
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.PermissionSet import PermissionSet, to_gql_permission_set
from phoenix.server.api.types.PlaygroundModel import PlaygroundModel
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.ProjectTraceRetentionPolicy import ProjectTraceRetentionPolicy
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptLabel import PromptLabel
from phoenix.server.api.types.PromptVersion import PromptVersion, to_gql_prompt_version
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag
from phoenix.server.api.types.PromptVersionTemplate import (
    ContentPart,
    PromptChatTemplate,
    PromptMessage,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
)
from phoenix.server.api.types.ResourceTag import (
    ResourceTag,
    TagAccessGrant,
    to_gql_tag_grant,
)
from phoenix.server.api.types.SandboxConfig import (
    SandboxBackendInfo,
    SandboxConfig,
    SandboxProvider,
    get_sandbox_backend_info,
)
from phoenix.server.api.types.Secret import Secret
from phoenix.server.api.types.ServerStatus import ServerStatus
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation
from phoenix.server.api.types.SystemApiKey import SystemApiKey
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation
from phoenix.server.api.types.User import User
from phoenix.server.api.types.UserApiKey import UserApiKey
from phoenix.server.api.types.UserGroup import LOCAL_PROVIDER, UserGroup, to_gql_user_group
from phoenix.server.api.types.UserRole import UserRole
from phoenix.server.api.types.ValidationResult import ValidationResult
from phoenix.server.sandbox.types import SANDBOX_BACKEND_TYPES
from phoenix.utilities.template_formatters import TemplateFormatterError

initialize_playground_clients()


@strawberry.input
class ModelsInput:
    provider_key: Optional[GenerativeProviderKey]
    model_name: Optional[str] = None
    openai_api_type: Optional[OpenAIApiType] = None


@strawberry.type
class DbTableStats:
    table_name: str
    num_bytes: float


@strawberry.type
class ExperimentRunMetricComparison:
    num_runs_improved: int = strawberry.field(
        description=(
            "The number of runs in which the base experiment improved "
            "on the best run in any compare experiment."
        )
    )
    num_runs_regressed: int = strawberry.field(
        description=(
            "The number of runs in which the base experiment regressed "
            "on the best run in any compare experiment."
        )
    )
    num_runs_equal: int = strawberry.field(
        description=(
            "The number of runs in which the base experiment is equal to the best run "
            "in any compare experiment."
        )
    )
    num_total_runs: strawberry.Private[int]

    @strawberry.field(
        description=(
            "The number of runs in the base experiment that could not be compared, either because "
            "the base experiment run was missing a value or because all compare experiment runs "
            "were missing values."
        )
    )  # type: ignore[untyped-decorator]
    def num_runs_without_comparison(self) -> int:
        return (
            self.num_total_runs
            - self.num_runs_improved
            - self.num_runs_regressed
            - self.num_runs_equal
        )


@strawberry.type
class ExperimentRunMetricComparisons:
    latency: ExperimentRunMetricComparison
    total_token_count: ExperimentRunMetricComparison
    prompt_token_count: ExperimentRunMetricComparison
    completion_token_count: ExperimentRunMetricComparison
    total_cost: ExperimentRunMetricComparison
    prompt_cost: ExperimentRunMetricComparison
    completion_cost: ExperimentRunMetricComparison


async def _parent_project_id(
    session: "AsyncSession", type_name: str, node_id: int
) -> Optional[int]:
    """The project a containment child belongs to, walking the containment edges.
    Annotations are reached through their span/trace; access derives from the project,
    never an independent grant on the child itself."""
    if type_name == Trace.__name__:
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Trace.project_rowid).where(models.Trace.id == node_id)
            ),
        )
    if type_name == Span.__name__:
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Trace.project_rowid)
                .join(models.Span, models.Span.trace_rowid == models.Trace.id)
                .where(models.Span.id == node_id)
            ),
        )
    if type_name == ProjectSession.__name__:
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.ProjectSession.project_id).where(models.ProjectSession.id == node_id)
            ),
        )
    if type_name == SpanAnnotation.__name__:
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Trace.project_rowid)
                .join(models.Span, models.Span.trace_rowid == models.Trace.id)
                .join(models.SpanAnnotation, models.SpanAnnotation.span_rowid == models.Span.id)
                .where(models.SpanAnnotation.id == node_id)
            ),
        )
    if type_name == TraceAnnotation.__name__:
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Trace.project_rowid)
                .join(models.TraceAnnotation, models.TraceAnnotation.trace_rowid == models.Trace.id)
                .where(models.TraceAnnotation.id == node_id)
            ),
        )
    return None


async def _containment_readable(info: Info[Context, None], type_name: str, node_id: int) -> bool:
    """Whether a containment child (span/trace/session/annotation) is readable — via
    its parent project's accessibility. Short-circuits when the actor sees everything."""
    async with info.context.db.read() as session:
        scope = await info.context.access_scope(session, OBJECT_TYPE_PROJECT)
        if scope.everything or scope.type_allows:
            return True
        project_id = await _parent_project_id(session, type_name, node_id)
    return project_id is not None and scope.allows(project_id)


async def _gate_containment_node(
    info: Info[Context, None], type_name: str, node_id: int, gid: strawberry.ID
) -> None:
    """Gate a containment-child node fetch by its parent project's accessibility.
    Unauthorized is indistinguishable from not-found."""
    if not await _containment_readable(info, type_name, node_id):
        raise NotFound(f"Unknown node: {gid}")


# The eval-world nodes derive access from their data context: dataset-rooted (experiments,
# runs, jobs, examples) or prompt-rooted (prompt versions). They never carry their own grant.
_EVAL_NODE_OBJECT_TYPE: dict[str, str] = {
    "DatasetExample": OBJECT_TYPE_DATASET,
    "Experiment": OBJECT_TYPE_DATASET,
    "ExperimentRun": OBJECT_TYPE_DATASET,
    "ExperimentJob": OBJECT_TYPE_DATASET,
    "PromptVersion": OBJECT_TYPE_PROMPT,
}


async def _eval_node_parent_id(
    session: "AsyncSession", type_name: str, node_id: int
) -> Optional[int]:
    """The dataset/prompt id an eval-world node derives access from (access-by-parent)."""
    if type_name == "DatasetExample":
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.DatasetExample.dataset_id).where(models.DatasetExample.id == node_id)
            ),
        )
    if type_name == "Experiment":
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Experiment.dataset_id).where(models.Experiment.id == node_id)
            ),
        )
    if type_name == "ExperimentRun":
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Experiment.dataset_id)
                .join(
                    models.ExperimentRun, models.ExperimentRun.experiment_id == models.Experiment.id
                )
                .where(models.ExperimentRun.id == node_id)
            ),
        )
    if type_name == "ExperimentJob":
        # experiment_jobs.id is a 1:1 FK to experiments.id.
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.Experiment.dataset_id).where(models.Experiment.id == node_id)
            ),
        )
    if type_name == "PromptVersion":
        return type_cast(
            Optional[int],
            await session.scalar(
                select(models.PromptVersion.prompt_id).where(models.PromptVersion.id == node_id)
            ),
        )
    return None


async def _eval_readable(info: Info[Context, None], type_name: str, node_id: int) -> bool:
    """Whether an eval-world node (experiment/run/job/example/prompt-version) is readable
    — via its parent dataset's or prompt's accessibility (access-by-parent)."""
    object_type = _EVAL_NODE_OBJECT_TYPE.get(type_name)
    if object_type is None:
        return True
    async with info.context.db.read() as session:
        scope = await info.context.access_scope(session, object_type)
        if scope.everything or scope.type_allows:
            return True
        parent_id = await _eval_node_parent_id(session, type_name, node_id)
    return parent_id is not None and scope.allows(parent_id)


async def _gate_eval_node(
    info: Info[Context, None], type_name: str, node_id: int, gid: strawberry.ID
) -> None:
    """Gate an eval-world node fetch by its parent dataset's or prompt's accessibility
    (access-by-parent). Unauthorized is indistinguishable from not-found."""
    if not await _eval_readable(info, type_name, node_id):
        raise NotFound(f"Unknown node: {gid}")


# The Relay type name and ORM model backing each grantable object kind, so a tag read can
# decode the object's GlobalID and confirm it exists.
_ACCESS_OBJECT_GQL: dict[AccessObjectType, tuple[str, type[models.HasId]]] = {
    AccessObjectType.PROJECT: ("Project", models.Project),
    AccessObjectType.DATASET: ("Dataset", models.Dataset),
    AccessObjectType.PROMPT: ("Prompt", models.Prompt),
}


async def _tag_grant_subject_names(
    session: AsyncSession, rows: Iterable[models.AccessGrant]
) -> dict[tuple[str, int], str]:
    """Display names keyed by (subject_kind, subject_id) for a batch of tag grants, so the list
    reads as people and groups rather than raw ids. EVERYONE carries no id and is named in the
    mapper. One query per referenced kind — not per row."""
    user_ids: set[int] = set()
    group_ids: set[int] = set()
    for row in rows:
        if row.subject_id is None:
            continue
        if row.subject_kind == SubjectKind.USER.value:
            user_ids.add(row.subject_id)
        elif row.subject_kind == SubjectKind.GROUP.value:
            group_ids.add(row.subject_id)
    names: dict[tuple[str, int], str] = {}
    if user_ids:
        for uid, username, email in (
            await session.execute(
                select(models.User.id, models.User.username, models.User.email).where(
                    models.User.id.in_(user_ids)
                )
            )
        ).all():
            names[(SubjectKind.USER.value, uid)] = email or username or f"user:{uid}"
    if group_ids:
        for gid, display_name, group_key in (
            await session.execute(
                select(
                    models.UserGroup.id,
                    models.UserGroup.display_name,
                    models.UserGroup.group_key,
                ).where(models.UserGroup.id.in_(group_ids))
            )
        ).all():
            names[(SubjectKind.GROUP.value, gid)] = display_name or group_key or f"group:{gid}"
    return names


@strawberry.type
class Query:
    @strawberry.field
    async def model_providers(self, info: Info[Context, None]) -> list[GenerativeProvider]:
        available_providers = PLAYGROUND_CLIENT_REGISTRY.list_all_providers()
        allowed = info.context.allowed_provider_names
        if allowed is not None:
            available_providers = [p for p in available_providers if p.name in allowed]
        return [
            GenerativeProvider(
                name=provider_key.value,
                key=provider_key,
            )
            for provider_key in available_providers
        ]

    @strawberry.field
    async def generative_model_custom_providers(
        self,
        info: Info[Context, None],
        first: int | None = 50,
        last: int | None = UNSET,
        after: CursorString | None = UNSET,
        before: CursorString | None = UNSET,
    ) -> Connection[GenerativeModelCustomProvider]:
        page_size = first or 50

        # Parse cursor for forward pagination
        after_cursor = Cursor.from_string(after) if after else None

        # Build query with ordering (descending by id)
        stmt = select(models.GenerativeModelCustomProvider).order_by(
            models.GenerativeModelCustomProvider.id.desc()
        )

        # Apply cursor filtering for forward pagination
        if after_cursor:
            # Get items with id < cursor.rowid (next items in desc order)
            stmt = stmt.where(models.GenerativeModelCustomProvider.id < after_cursor.rowid)

        # Fetch one extra item to check for next page
        stmt = stmt.limit(page_size + 1)

        async with info.context.db.read() as session:
            providers = (await session.scalars(stmt)).all()

        # Check for next page
        has_next_page = len(providers) > page_size
        if has_next_page:
            providers = providers[:page_size]

        # has_previous_page is True if we have an after cursor (we're not at the start)
        has_previous_page = after_cursor is not None

        # Convert ORM models to GraphQL types and create cursors
        cursors_and_nodes: list[tuple[Cursor, GenerativeModelCustomProvider]] = []

        for provider in providers:
            gql_provider = GenerativeModelCustomProvider(id=provider.id, db_record=provider)
            cursors_and_nodes.append((Cursor(rowid=provider.id), gql_provider))

        return connection_from_cursors_and_nodes(
            cursors_and_nodes=cursors_and_nodes,
            has_previous_page=has_previous_page,
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def secrets(
        self,
        info: Info[Context, None],
        keys: list[str] | None = None,
        first: int | None = 50,
        last: int | None = UNSET,
        after: CursorString | None = UNSET,
        before: CursorString | None = UNSET,
    ) -> Connection[Secret]:
        page_size = first or 50

        stmt = select(models.Secret).order_by(models.Secret.key)
        if keys:
            keys = list({k.strip() for k in keys if k.strip()})
            if keys:
                stmt = stmt.where(models.Secret.key.in_(keys))
        if after:
            stmt = stmt.where(models.Secret.key > after)
        stmt = stmt.limit(page_size + 1)
        async with info.context.db.read() as session:
            secrets = (await session.scalars(stmt)).all()

        has_next_page = len(secrets) > page_size
        if has_next_page:
            secrets = secrets[:page_size]
        has_previous_page = bool(after)
        cursors_and_nodes: list[tuple[str, Secret]] = []
        for secret in secrets:
            cursors_and_nodes.append((secret.key, Secret(id=secret.key, db_record=secret)))
        return connection_from_cursors_and_nodes(
            cursors_and_nodes=cursors_and_nodes,
            has_previous_page=has_previous_page,
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def generative_models(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[GenerativeModel]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db.read() as session:
            result = await session.scalars(
                select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.is_(None))
                .order_by(
                    models.GenerativeModel.is_built_in.asc(),  # display custom models first
                    models.GenerativeModel.provider.nullslast(),
                    models.GenerativeModel.name,
                )
            )
            data = [GenerativeModel(id=model.id, db_record=model) for model in result.unique()]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def playground_models(self, input: Optional[ModelsInput] = None) -> list[PlaygroundModel]:
        if input is not None and input.provider_key is not None:
            supported_model_names = PLAYGROUND_CLIENT_REGISTRY.list_models(input.provider_key)
            supported_models = [
                PlaygroundModel(name_value=model_name, provider_key_value=input.provider_key)
                for model_name in supported_model_names
            ]
            return supported_models

        registered_models = PLAYGROUND_CLIENT_REGISTRY.list_all_models()
        all_models: list[PlaygroundModel] = []
        for provider_key, model_name in registered_models:
            if model_name is not None and provider_key is not None:
                all_models.append(
                    PlaygroundModel(name_value=model_name, provider_key_value=provider_key)
                )
        return all_models

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def users(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        filter: Optional[UserFilter] = UNSET,
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
        if filter is not UNSET and filter and filter.value:
            value = filter.value.strip()
            if value:
                search = f"%{value}%"
                stmt = stmt.where(
                    or_(models.User.email.ilike(search), models.User.username.ilike(search))
                )
        async with info.context.db.read() as session:
            users = await session.stream_scalars(stmt)
            data = [User(id=user.id, db_record=user) async for user in users]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def user_roles(
        self,
        info: Info[Context, None],
    ) -> list[UserRole]:
        async with info.context.db.read() as session:
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
        async with info.context.db.read() as session:
            api_keys = await session.scalars(stmt)
        return [UserApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def system_api_keys(self, info: Info[Context, None]) -> list[SystemApiKey]:
        stmt = (
            select(models.ApiKey)
            .join(models.User)
            .join(models.UserRole)
            .where(models.UserRole.name == "SYSTEM")
        )
        async with info.context.db.read() as session:
            api_keys = await session.scalars(stmt)
        return [SystemApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

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
        projects_query = select(models.Project)

        if sort and sort.col is ProjectColumn.endTime:
            # For end time sorting, we need to use a correlated subquery
            # The end_time comes from the Trace model, and we need to get the max end_time for
            # each project
            end_time_subq = (
                select(func.max(models.Trace.start_time))
                .where(models.Trace.project_rowid == models.Project.id)
                .scalar_subquery()
            )
            projects_query = projects_query.order_by(
                end_time_subq.desc() if sort.dir is SortDir.desc else end_time_subq.asc()
            )
        elif sort:
            sort_col = getattr(models.Project, sort.col.value)
            projects_query = projects_query.order_by(
                sort_col.desc() if sort.dir is SortDir.desc else sort_col.asc()
            )
        if filter:
            projects_query = projects_query.where(
                getattr(models.Project, filter.col.value).ilike(f"%{filter.value}%")
            )
        projects_query = exclude_experiment_projects(projects_query)
        projects_query = exclude_dataset_evaluator_projects(projects_query)
        async with info.context.db.read() as session:
            # Restrict to the projects this actor may access. A no-op when access
            # control is disabled.
            projects_query = projects_query.where(
                await info.context.access_filter(session, OBJECT_TYPE_PROJECT, models.Project.id)
            )
            projects = await session.stream_scalars(projects_query)
            data = [Project(id=project.id, db_record=project) async for project in projects]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    def projects_last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Project)

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore[untyped-decorator]
    async def permission_sets(self, info: Info[Context, None]) -> list[PermissionSet]:
        """The permission sets available when granting access — built-in presets plus
        any custom roles. Drives the role picker and the roles admin view."""
        async with info.context.db.read() as session:
            roles = (
                await session.scalars(
                    select(models.PermissionSet)
                    .options(joinedload(models.PermissionSet.permissions))
                    .order_by(models.PermissionSet.is_built_in.desc(), models.PermissionSet.name)
                )
            ).unique()
        return [to_gql_permission_set(role) for role in roles]

    @strawberry.field(permission_classes=[IsAdminIfAuthEnabled])  # type: ignore[untyped-decorator]
    async def resource_tags(
        self,
        info: Info[Context, None],
        object_type: AccessObjectType,
        object_id: GlobalID,
    ) -> list[ResourceTag]:
        """The curated ``key=value`` tags on one access-controlled object — the read-back for
        ``setResourceTag`` / ``removeResourceTag``. Admin-gated when auth is enabled (open
        otherwise, as access control presupposes auth)."""
        type_name, model = _ACCESS_OBJECT_GQL[object_type]
        try:
            rowid = from_global_id_with_expected_type(object_id, type_name)
        except ValueError:
            raise NotFound(f"Unknown {type_name}: {object_id}") from None
        async with info.context.db.read() as session:
            if await session.scalar(select(model.id).where(model.id == rowid)) is None:
                raise NotFound(f"Unknown {type_name}: {object_id}")
            rows = (
                await session.execute(
                    select(models.ResourceTag.key, models.ResourceTag.value)
                    .where(
                        models.ResourceTag.object_type == object_type.value,
                        models.ResourceTag.object_id == rowid,
                    )
                    .order_by(models.ResourceTag.key)
                )
            ).all()
        return [ResourceTag(key=key, value=value) for key, value in rows]

    @strawberry.field(permission_classes=[IsAdminIfAuthEnabled])  # type: ignore[untyped-decorator]
    async def tag_grants(
        self,
        info: Info[Context, None],
        object_type: Optional[AccessObjectType] = None,
    ) -> list[TagAccessGrant]:
        """The tag grants (optionally scoped to one object type) — the read-back for
        ``grantTagAccess`` / ``revokeTagAccess``. Type-scoped policy, so admin-gated like
        authoring one (open when auth is disabled)."""
        async with info.context.db.read() as session:
            stmt = select(models.AccessGrant).where(
                models.AccessGrant.effect == "allow",
                models.AccessGrant.selector_kind == "tag",
            )
            if object_type is not None:
                stmt = stmt.where(models.AccessGrant.object_type == object_type.value)
            rows = (await session.scalars(stmt.order_by(models.AccessGrant.id.desc()))).all()
            role_names: dict[int, str] = {
                rid: name
                for rid, name in (
                    await session.execute(
                        select(models.PermissionSet.id, models.PermissionSet.name)
                    )
                ).all()
            }
            subject_names = await _tag_grant_subject_names(session, rows)
        return [to_gql_tag_grant(row, role_names, subject_names) for row in rows]

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore[untyped-decorator]
    async def user_groups(
        self, info: Info[Context, None], local_only: bool = False
    ) -> list[UserGroup]:
        """Groups usable as grant subjects. ``local_only`` filters to admin-managed
        groups (the manageable set); the full list also includes IdP-synced groups, for
        the grant picker."""
        async with info.context.db.read() as session:
            stmt = select(models.UserGroup).order_by(models.UserGroup.id)
            if local_only:
                stmt = stmt.where(models.UserGroup.provider == LOCAL_PROVIDER)
            groups = (await session.scalars(stmt)).all()
            result: list[UserGroup] = []
            for group in groups:
                member_ids = list(
                    await session.scalars(
                        select(models.UserGroupMembership.user_id).where(
                            models.UserGroupMembership.user_group_id == group.id
                        )
                    )
                )
                result.append(to_gql_user_group(group, member_ids))
        return result

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
            # Apply name filter
            if filter.col and filter.value:
                stmt = stmt.where(
                    getattr(models.Dataset, filter.col.value).ilike(f"%{filter.value}%")
                )

            # Apply label filter
            if filter.filter_labels and filter.filter_labels is not UNSET:
                label_rowids = []
                for label_id in filter.filter_labels:
                    try:
                        label_rowid = from_global_id_with_expected_type(
                            global_id=GlobalID.from_id(label_id),
                            expected_type_name="DatasetLabel",
                        )
                        label_rowids.append(label_rowid)
                    except ValueError:
                        continue  # Skip invalid label IDs

                if label_rowids:
                    # Join with the junction table to filter by labels
                    stmt = (
                        stmt.join(
                            models.DatasetsDatasetLabel,
                            models.Dataset.id == models.DatasetsDatasetLabel.dataset_id,
                        )
                        .where(models.DatasetsDatasetLabel.dataset_label_id.in_(label_rowids))
                        .distinct()
                    )
        async with info.context.db.read() as session:
            # Restrict to the datasets this actor may access (creator-private +
            # grants). A no-op when access control is disabled.
            stmt = stmt.where(
                await info.context.access_filter(session, OBJECT_TYPE_DATASET, models.Dataset.id)
            )
            datasets = await session.scalars(stmt)
        return connection_from_list(
            data=[Dataset(id=dataset.id, db_record=dataset) for dataset in datasets], args=args
        )

    @strawberry.field
    def datasets_last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Dataset)

    @strawberry.field
    async def compare_experiments(
        self,
        info: Info[Context, None],
        base_experiment_id: GlobalID,
        compare_experiment_ids: list[GlobalID],
        first: Optional[int] = 50,
        after: Optional[CursorString] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Connection[ExperimentComparison]:
        if base_experiment_id in compare_experiment_ids:
            raise BadRequest("Compare experiment IDs cannot contain the base experiment ID")
        if len(set(compare_experiment_ids)) < len(compare_experiment_ids):
            raise BadRequest("Compare experiment IDs must be unique")

        try:
            base_experiment_rowid = from_global_id_with_expected_type(
                base_experiment_id, models.Experiment.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid base experiment ID: {base_experiment_id}")

        compare_experiment_rowids = []
        for compare_experiment_id in compare_experiment_ids:
            try:
                compare_experiment_rowids.append(
                    from_global_id_with_expected_type(
                        compare_experiment_id, models.Experiment.__name__
                    )
                )
            except ValueError:
                raise BadRequest(f"Invalid compare experiment ID: {compare_experiment_id}")

        experiment_rowids = [base_experiment_rowid, *compare_experiment_rowids]

        # Every named experiment must be readable via its dataset (access-by-parent).
        for rowid in experiment_rowids:
            if not await _eval_readable(info, "Experiment", rowid):
                raise NotFound("Unknown experiment")

        cursor = Cursor.from_string(after) if after else None
        page_size = first or 50

        async with info.context.db.read() as session:
            experiments = (
                await session.scalars(
                    select(
                        models.Experiment,
                    )
                    .where(models.Experiment.id.in_(experiment_rowids))
                    .options(
                        load_only(
                            models.Experiment.dataset_id, models.Experiment.dataset_version_id
                        )
                    )
                )
            ).all()

            if not experiments or len(experiments) < len(experiment_rowids):
                raise NotFound("Unable to resolve one or more experiment IDs.")
            num_datasets = len(set(experiment.dataset_id for experiment in experiments))
            if num_datasets > 1:
                raise BadRequest("Experiments must belong to the same dataset.")
            base_experiment = next(
                experiment for experiment in experiments if experiment.id == base_experiment_rowid
            )

            # Use ExperimentDatasetExample to pull down examples.
            # Splits are mutable and should not be used for comparison.
            # The comparison should only occur against examples which were assigned to the same
            # splits at the time of execution of the ExperimentRun.
            examples_query = (
                select(models.DatasetExample)
                .join(models.ExperimentDatasetExample)
                .where(models.ExperimentDatasetExample.experiment_id == base_experiment_rowid)
                .order_by(models.DatasetExample.id.asc())
                .limit(page_size + 1)
            )

            if cursor is not None:
                examples_query = examples_query.where(models.DatasetExample.id > cursor.rowid)

            if filter_condition:
                examples_query = update_examples_query_with_filter_condition(
                    query=examples_query,
                    filter_condition=filter_condition,
                    experiment_ids=experiment_rowids,
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
                        models.ExperimentRun.experiment_id.in_(experiment_rowids),
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
            repeated_run_groups = []
            for experiment_id in experiment_rowids:
                repeated_run_groups.append(
                    ExperimentRepeatedRunGroup(
                        experiment_rowid=experiment_id,
                        dataset_example_rowid=example.id,
                        cached_runs=[
                            ExperimentRun(id=run.id, db_record=run)
                            for run in sorted(
                                runs[example.id][experiment_id],
                                key=lambda run: run.repetition_number,
                            )
                        ],
                    )
                )
            experiment_comparison = ExperimentComparison(
                id_attr=example.id,
                example=DatasetExample(
                    id=example.id,
                    db_record=example,
                    version_id=base_experiment.dataset_version_id,
                ),
                repeated_run_groups=repeated_run_groups,
            )
            cursors_and_nodes.append((Cursor(rowid=example.id), experiment_comparison))

        return connection_from_cursors_and_nodes(
            cursors_and_nodes=cursors_and_nodes,
            has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def experiment_run_metric_comparisons(
        self,
        info: Info[Context, None],
        base_experiment_id: GlobalID,
        compare_experiment_ids: list[GlobalID],
    ) -> ExperimentRunMetricComparisons:
        if base_experiment_id in compare_experiment_ids:
            raise BadRequest("Compare experiment IDs cannot contain the base experiment ID")
        if not compare_experiment_ids:
            raise BadRequest("At least one compare experiment ID must be provided")
        if len(set(compare_experiment_ids)) < len(compare_experiment_ids):
            raise BadRequest("Compare experiment IDs must be unique")

        try:
            base_experiment_rowid = from_global_id_with_expected_type(
                base_experiment_id, models.Experiment.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid base experiment ID: {base_experiment_id}")

        compare_experiment_rowids = []
        for compare_experiment_id in compare_experiment_ids:
            try:
                compare_experiment_rowids.append(
                    from_global_id_with_expected_type(
                        compare_experiment_id, models.Experiment.__name__
                    )
                )
            except ValueError:
                raise BadRequest(f"Invalid compare experiment ID: {compare_experiment_id}")

        # Every named experiment must be readable via its dataset (access-by-parent).
        for rowid in (base_experiment_rowid, *compare_experiment_rowids):
            if not await _eval_readable(info, "Experiment", rowid):
                raise NotFound("Unknown experiment")

        base_experiment_runs = (
            select(
                models.ExperimentRun.dataset_example_id,
                func.min(models.ExperimentRun.start_time).label("start_time"),
                func.min(models.ExperimentRun.end_time).label("end_time"),
                func.sum(models.SpanCost.total_tokens).label("total_tokens"),
                func.sum(models.SpanCost.prompt_tokens).label("prompt_tokens"),
                func.sum(models.SpanCost.completion_tokens).label("completion_tokens"),
                func.sum(models.SpanCost.total_cost).label("total_cost"),
                func.sum(models.SpanCost.prompt_cost).label("prompt_cost"),
                func.sum(models.SpanCost.completion_cost).label("completion_cost"),
            )
            .select_from(models.ExperimentRun)
            .join(
                models.Trace,
                onclause=models.ExperimentRun.trace_id == models.Trace.trace_id,
                isouter=True,
            )
            .join(
                models.SpanCost,
                onclause=models.Trace.id == models.SpanCost.trace_rowid,
                isouter=True,
            )
            .where(models.ExperimentRun.experiment_id == base_experiment_rowid)
            .group_by(models.ExperimentRun.dataset_example_id)
            .subquery()
            .alias("base_experiment_runs")
        )
        compare_experiment_runs = (
            select(
                models.ExperimentRun.dataset_example_id,
                func.min(
                    LatencyMs(models.ExperimentRun.start_time, models.ExperimentRun.end_time)
                ).label("min_latency_ms"),
                func.min(models.SpanCost.total_tokens).label("min_total_tokens"),
                func.min(models.SpanCost.prompt_tokens).label("min_prompt_tokens"),
                func.min(models.SpanCost.completion_tokens).label("min_completion_tokens"),
                func.min(models.SpanCost.total_cost).label("min_total_cost"),
                func.min(models.SpanCost.prompt_cost).label("min_prompt_cost"),
                func.min(models.SpanCost.completion_cost).label("min_completion_cost"),
            )
            .select_from(models.ExperimentRun)
            .join(
                models.Trace,
                onclause=models.ExperimentRun.trace_id == models.Trace.trace_id,
                isouter=True,
            )
            .join(
                models.SpanCost,
                onclause=models.Trace.id == models.SpanCost.trace_rowid,
                isouter=True,
            )
            .where(
                models.ExperimentRun.experiment_id.in_(compare_experiment_rowids),
            )
            .group_by(models.ExperimentRun.dataset_example_id)
            .subquery()
            .alias("comp_exp_run_mins")
        )

        base_experiment_run_latency = LatencyMs(
            base_experiment_runs.c.start_time, base_experiment_runs.c.end_time
        ).label("base_experiment_run_latency_ms")

        comparisons_query = (
            select(
                func.count().label("num_base_experiment_runs"),
                _comparison_count_expression(
                    base_column=base_experiment_run_latency,
                    compare_column=compare_experiment_runs.c.min_latency_ms,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_latency_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_run_latency,
                    compare_column=compare_experiment_runs.c.min_latency_ms,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_latency_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_run_latency,
                    compare_column=compare_experiment_runs.c.min_latency_ms,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_latency_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_tokens,
                    compare_column=compare_experiment_runs.c.min_total_tokens,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_total_token_count_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_tokens,
                    compare_column=compare_experiment_runs.c.min_total_tokens,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_total_token_count_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_tokens,
                    compare_column=compare_experiment_runs.c.min_total_tokens,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_total_token_count_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_tokens,
                    compare_column=compare_experiment_runs.c.min_prompt_tokens,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_prompt_token_count_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_tokens,
                    compare_column=compare_experiment_runs.c.min_prompt_tokens,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_prompt_token_count_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_tokens,
                    compare_column=compare_experiment_runs.c.min_prompt_tokens,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_prompt_token_count_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_tokens,
                    compare_column=compare_experiment_runs.c.min_completion_tokens,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_completion_token_count_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_tokens,
                    compare_column=compare_experiment_runs.c.min_completion_tokens,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_completion_token_count_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_tokens,
                    compare_column=compare_experiment_runs.c.min_completion_tokens,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_completion_token_count_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_cost,
                    compare_column=compare_experiment_runs.c.min_total_cost,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_total_cost_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_cost,
                    compare_column=compare_experiment_runs.c.min_total_cost,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_total_cost_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.total_cost,
                    compare_column=compare_experiment_runs.c.min_total_cost,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_total_cost_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_cost,
                    compare_column=compare_experiment_runs.c.min_prompt_cost,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_prompt_cost_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_cost,
                    compare_column=compare_experiment_runs.c.min_prompt_cost,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_prompt_cost_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.prompt_cost,
                    compare_column=compare_experiment_runs.c.min_prompt_cost,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_prompt_cost_is_equal"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_cost,
                    compare_column=compare_experiment_runs.c.min_completion_cost,
                    optimization_direction="minimize",
                    comparison_type="improvement",
                ).label("num_completion_cost_improved"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_cost,
                    compare_column=compare_experiment_runs.c.min_completion_cost,
                    optimization_direction="minimize",
                    comparison_type="regression",
                ).label("num_completion_cost_regressed"),
                _comparison_count_expression(
                    base_column=base_experiment_runs.c.completion_cost,
                    compare_column=compare_experiment_runs.c.min_completion_cost,
                    optimization_direction="minimize",
                    comparison_type="equality",
                ).label("num_completion_cost_is_equal"),
            )
            .select_from(base_experiment_runs)
            .join(
                compare_experiment_runs,
                onclause=base_experiment_runs.c.dataset_example_id
                == compare_experiment_runs.c.dataset_example_id,
                isouter=True,
            )
        )

        async with info.context.db.read() as session:
            result = (await session.execute(comparisons_query)).first()
        assert result is not None

        return ExperimentRunMetricComparisons(
            latency=ExperimentRunMetricComparison(
                num_runs_improved=result.num_latency_improved,
                num_runs_regressed=result.num_latency_regressed,
                num_runs_equal=result.num_latency_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            total_token_count=ExperimentRunMetricComparison(
                num_runs_improved=result.num_total_token_count_improved,
                num_runs_regressed=result.num_total_token_count_regressed,
                num_runs_equal=result.num_total_token_count_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            prompt_token_count=ExperimentRunMetricComparison(
                num_runs_improved=result.num_prompt_token_count_improved,
                num_runs_regressed=result.num_prompt_token_count_regressed,
                num_runs_equal=result.num_prompt_token_count_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            completion_token_count=ExperimentRunMetricComparison(
                num_runs_improved=result.num_completion_token_count_improved,
                num_runs_regressed=result.num_completion_token_count_regressed,
                num_runs_equal=result.num_completion_token_count_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            total_cost=ExperimentRunMetricComparison(
                num_runs_improved=result.num_total_cost_improved,
                num_runs_regressed=result.num_total_cost_regressed,
                num_runs_equal=result.num_total_cost_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            prompt_cost=ExperimentRunMetricComparison(
                num_runs_improved=result.num_prompt_cost_improved,
                num_runs_regressed=result.num_prompt_cost_regressed,
                num_runs_equal=result.num_prompt_cost_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
            completion_cost=ExperimentRunMetricComparison(
                num_runs_improved=result.num_completion_cost_improved,
                num_runs_regressed=result.num_completion_cost_regressed,
                num_runs_equal=result.num_completion_cost_is_equal,
                num_total_runs=result.num_base_experiment_runs,
            ),
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
    async def node(self, id: strawberry.ID, info: Info[Context, None]) -> Node:
        if is_composite_global_id(id):
            try:
                experiment_rowid, dataset_example_rowid = (
                    parse_experiment_repeated_run_group_node_id(id)
                )
            except Exception:
                raise NotFound(f"Unknown node: {id}")
            # The run group is readable iff its experiment's dataset is (access-by-parent).
            if not await _eval_readable(info, "Experiment", experiment_rowid):
                raise NotFound(f"Unknown node: {id}")
            return ExperimentRepeatedRunGroup(
                experiment_rowid=experiment_rowid,
                dataset_example_rowid=dataset_example_rowid,
            )

        try:
            global_id = GlobalID.from_id(id)
        except ValueError:
            raise NotFound(f"Unknown node: {id}") from None
        type_name = global_id.type_name
        if type_name == Secret.__name__:
            return Secret(id=global_id.node_id)
        if type_name == SandboxProvider.__name__:
            backend_type = global_id.node_id
            if backend_type not in SANDBOX_BACKEND_TYPES:
                raise NotFound(f"Unknown sandbox backend type: {backend_type}")
            return SandboxProvider(id=backend_type)
        try:
            node_id = int(global_id.node_id)
        except ValueError:
            raise BadRequest(
                f"Invalid node id: {id}. The id of a {type_name} node must be an integer, "
                f"but got: {global_id.node_id}"
            ) from None
        if type_name == "Dimension" or type_name == "EmbeddingDimension":
            raise NotFound(f"Unknown node type: {type_name}")
        if type_name == Project.__name__:
            async with info.context.db.read() as session:
                # Existence and access are distinct: can_access alone answers True for an
                # administrator or a type-wide grant holder even for an id that names no
                # project, so a bare authorization check would resolve a nonexistent node to
                # a stub. Confirm the row exists, then gate on access (short-circuited).
                exists_row = await session.scalar(
                    select(models.Project.id).where(models.Project.id == node_id)
                )
                readable = exists_row is not None and await info.context.can_access(
                    session, OBJECT_TYPE_PROJECT, node_id
                )
            if not readable:
                raise NotFound(f"Unknown node: {id}")
            return Project(id=node_id)
        elif type_name == Trace.__name__:
            await _gate_containment_node(info, type_name, node_id, id)
            return Trace(id=node_id)
        elif type_name == Span.__name__:
            await _gate_containment_node(info, type_name, node_id, id)
            return Span(id=node_id)
        elif type_name == Dataset.__name__:
            async with info.context.db.read() as session:
                scope = await info.context.access_scope(session, OBJECT_TYPE_DATASET)
            if not scope.allows(node_id):
                raise NotFound(f"Unknown node: {id}")
            return Dataset(id=node_id)
        elif type_name == DatasetExample.__name__:
            await _gate_eval_node(info, type_name, node_id, id)
            return DatasetExample(id=node_id)
        elif type_name == DatasetSplit.__name__:
            return DatasetSplit(id=node_id)
        elif type_name == Experiment.__name__:
            await _gate_eval_node(info, type_name, node_id, id)
            return Experiment(id=node_id)
        elif type_name == ExperimentRun.__name__:
            await _gate_eval_node(info, type_name, node_id, id)
            return ExperimentRun(id=node_id)
        elif type_name == ExperimentJob.__name__:
            await _gate_eval_node(info, type_name, node_id, id)
            return ExperimentJob(id=node_id)
        elif type_name == User.__name__:
            if int((user := info.context.user).identity) != node_id and not user.is_admin:
                raise Unauthorized(MSG_ADMIN_ONLY)
            return User(id=node_id)
        elif type_name == UserGroup.__name__:
            if not info.context.user.is_admin:
                raise Unauthorized(MSG_ADMIN_ONLY)
            async with info.context.db.read() as session:
                group = await session.get(models.UserGroup, node_id)
                if group is None:
                    raise NotFound(f"Unknown node: {id}")
                member_ids = list(
                    await session.scalars(
                        select(models.UserGroupMembership.user_id).where(
                            models.UserGroupMembership.user_group_id == group.id
                        )
                    )
                )
            return to_gql_user_group(group, member_ids)
        elif type_name == PermissionSet.__name__:
            if not info.context.user.is_admin:
                raise Unauthorized(MSG_ADMIN_ONLY)
            async with info.context.db.read() as session:
                role = await session.scalar(
                    select(models.PermissionSet)
                    .options(joinedload(models.PermissionSet.permissions))
                    .where(models.PermissionSet.id == node_id)
                )
            if role is None:
                raise NotFound(f"Unknown node: {id}")
            return to_gql_permission_set(role)
        elif type_name == ProjectSession.__name__:
            await _gate_containment_node(info, type_name, node_id, id)
            return ProjectSession(id=node_id)
        elif type_name == Prompt.__name__:
            async with info.context.db.read() as session:
                scope = await info.context.access_scope(session, OBJECT_TYPE_PROMPT)
            if not scope.allows(node_id):
                raise NotFound(f"Unknown node: {id}")
            return Prompt(id=node_id)
        elif type_name == PromptVersion.__name__:
            await _gate_eval_node(info, type_name, node_id, id)
            async with info.context.db.read() as session:
                if orm_prompt_version := await session.scalar(
                    select(models.PromptVersion).where(models.PromptVersion.id == node_id)
                ):
                    return to_gql_prompt_version(orm_prompt_version)
                else:
                    raise NotFound(f"Unknown prompt version: {id}")
        elif type_name == PromptLabel.__name__:
            return PromptLabel(id=node_id)
        elif type_name == PromptVersionTag.__name__:
            return PromptVersionTag(id=node_id)
        elif type_name == ProjectTraceRetentionPolicy.__name__:
            return ProjectTraceRetentionPolicy(id=node_id)
        elif type_name == SpanAnnotation.__name__:
            await _gate_containment_node(info, type_name, node_id, id)
            return SpanAnnotation(id=node_id)
        elif type_name == TraceAnnotation.__name__:
            await _gate_containment_node(info, type_name, node_id, id)
            return TraceAnnotation(id=node_id)
        elif type_name == GenerativeModel.__name__:
            return GenerativeModel(id=node_id)
        elif type_name == LLMEvaluator.__name__:
            return LLMEvaluator(id=node_id)
        elif type_name == CodeEvaluator.__name__:
            return CodeEvaluator(id=node_id)
        elif type_name == BuiltInEvaluator.__name__:
            return BuiltInEvaluator(id=node_id)
        elif type_name == DatasetEvaluator.__name__:
            return DatasetEvaluator(id=node_id)
        elif type_name == SandboxConfig.__name__:
            return SandboxConfig(id=node_id)
        if type_name == GenerativeModelCustomProvider.__name__:
            return GenerativeModelCustomProvider(id=node_id)
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
        return User(id=int(user.identity))

    @strawberry.field
    async def prompts(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        filter: Optional[PromptFilter] = UNSET,
        labelIds: Optional[list[GlobalID]] = UNSET,
    ) -> Connection[Prompt]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.Prompt).order_by(
            models.Prompt.created_at.desc(),
            models.Prompt.id.desc(),
        )
        if filter:
            column = getattr(models.Prompt, filter.col.value)
            # Cast Identifier columns to String for ilike operations
            if filter.col.value == "name":
                column = cast(column, String)
            stmt = stmt.where(column.ilike(f"%{filter.value}%"))
        if labelIds:
            stmt = stmt.join(models.PromptPromptLabel).where(
                models.PromptPromptLabel.prompt_label_id.in_(
                    from_global_id_with_expected_type(
                        global_id=label_id, expected_type_name="PromptLabel"
                    )
                    for label_id in labelIds
                )
            )
            stmt = stmt.distinct()
        async with info.context.db.read() as session:
            # Restrict to the prompts this actor may access (creator-private +
            # grants). A no-op when access control is disabled.
            stmt = stmt.where(
                await info.context.access_filter(session, OBJECT_TYPE_PROMPT, models.Prompt.id)
            )
            orm_prompts = await session.stream_scalars(stmt)
            data = [
                Prompt(id=orm_prompt.id, db_record=orm_prompt) async for orm_prompt in orm_prompts
            ]
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
        async with info.context.db.read() as session:
            prompt_labels = await session.stream_scalars(select(models.PromptLabel))
            data = [
                PromptLabel(id=prompt_label.id, db_record=prompt_label)
                async for prompt_label in prompt_labels
            ]
            return connection_from_list(
                data=data,
                args=args,
            )

    @strawberry.field
    async def dataset_labels(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        names: Annotated[
            Optional[list[str]],
            strawberry.argument(
                description="When provided, return only labels whose name exactly "
                "matches one of the given names — a lookup that avoids paging "
                "through the entire instance-wide vocabulary."
            ),
        ] = UNSET,
    ) -> Connection[DatasetLabel]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.DatasetLabel).order_by(models.DatasetLabel.name.asc())
        if names:
            # Exact-match lookup so callers can resolve names to ids without
            # paging through the entire instance-wide vocabulary.
            stmt = stmt.where(models.DatasetLabel.name.in_(names))
        async with info.context.db.read() as session:
            dataset_labels = await session.scalars(stmt)
        data = [
            DatasetLabel(id=dataset_label.id, db_record=dataset_label)
            for dataset_label in dataset_labels
        ]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def dataset_splits(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        names: Annotated[
            Optional[list[str]],
            strawberry.argument(
                description="When provided, return only splits whose name exactly "
                "matches one of the given names — a lookup that avoids paging "
                "through the entire instance-wide vocabulary."
            ),
        ] = UNSET,
    ) -> Connection[DatasetSplit]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = select(models.DatasetSplit)
        if names:
            # Exact-match lookup so callers can resolve names to ids without
            # paging through the entire instance-wide vocabulary.
            stmt = stmt.where(models.DatasetSplit.name.in_(names))
        async with info.context.db.read() as session:
            splits = await session.stream_scalars(stmt)
            data = [DatasetSplit(id=split.id, db_record=split) async for split in splits]
            return connection_from_list(
                data=data,
                args=args,
            )

    @strawberry.field
    async def built_in_evaluators(self, info: Info[Context, None]) -> list[BuiltInEvaluator]:
        async with info.context.db.read() as session:
            result = await session.execute(select(models.BuiltinEvaluator))
            return [BuiltInEvaluator(id=row.id) for row in result.scalars()]

    @strawberry.field
    async def evaluators(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        sort: Optional[EvaluatorSort] = UNSET,
        filter: Optional[EvaluatorFilter] = UNSET,
    ) -> Connection[Evaluator]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        # The resolvers on the various evaluator GraphQL types read from the ORM, so we need to
        # ensure that all fields of the polymorphic ORMs are loaded, not just the fields of the
        # base `evaluators` table.
        PolymorphicEvaluator = with_polymorphic(
            models.Evaluator, [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator]
        )  # eagerly join sub-classed evaluator tables

        has_dataset_association = exists(
            select(models.DatasetEvaluators.id).where(
                models.DatasetEvaluators.evaluator_id == PolymorphicEvaluator.id
            )
        )
        query = select(PolymorphicEvaluator).where(
            or_(
                # non-builtin evaluators are always included
                PolymorphicEvaluator.kind != "BUILTIN",
                # builtin evaluators are only included if associated with at least one dataset
                has_dataset_association,
            )
        )

        if filter:
            if filter.col.value == "name":
                parent_name_col = cast(PolymorphicEvaluator.name, String)
                # Match parent name OR any child (datasetEvaluator) name
                child_name_exists = exists(
                    select(models.DatasetEvaluators.id)
                    .where(models.DatasetEvaluators.evaluator_id == PolymorphicEvaluator.id)
                    .where(cast(models.DatasetEvaluators.name, String).ilike(f"%{filter.value}%"))
                )
                query = query.where(
                    or_(
                        parent_name_col.ilike(f"%{filter.value}%"),
                        child_name_exists,
                    )
                )
            else:
                column = getattr(PolymorphicEvaluator, filter.col.value)
                query = query.where(column.ilike(f"%{filter.value}%"))

        if sort:
            if sort.col.value == "updated_at":
                # updated_at exists in sub-tables, not base table
                # Use case to pick the value based on kind
                # this special case can be removed if we add updated_at to the base table
                sort_col = case(
                    (PolymorphicEvaluator.kind == "LLM", models.LLMEvaluator.updated_at),
                    (PolymorphicEvaluator.kind == "CODE", models.CodeEvaluator.updated_at),
                    (PolymorphicEvaluator.kind == "BUILTIN", models.BuiltinEvaluator.synced_at),
                    else_=None,
                )
            else:
                sort_col = getattr(PolymorphicEvaluator, sort.col.value)
            query = query.order_by(sort_col.desc() if sort.dir is SortDir.desc else sort_col.asc())
        else:
            query = query.order_by(PolymorphicEvaluator.name.asc())

        async with info.context.db.read() as session:
            evaluators = await session.scalars(query)
        data: list[Evaluator] = []
        for evaluator in evaluators:
            if isinstance(evaluator, models.LLMEvaluator):
                data.append(LLMEvaluator(id=evaluator.id, db_record=evaluator))
            elif isinstance(evaluator, models.CodeEvaluator):
                data.append(CodeEvaluator(id=evaluator.id, db_record=evaluator))
            elif isinstance(evaluator, models.BuiltinEvaluator):
                data.append(BuiltInEvaluator(id=evaluator.id, db_record=evaluator))
            else:
                raise ValueError(f"Unknown evaluator type: {type(evaluator)}")

        return connection_from_list(data=data, args=args)

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
        async with info.context.db.read() as session:
            configs = await session.stream_scalars(
                select(models.AnnotationConfig).order_by(models.AnnotationConfig.name)
            )
            data = [to_gql_annotation_config(config) async for config in configs]
            return connection_from_list(data=data, args=args)

    @strawberry.field
    async def classification_evaluator_configs(
        self,
        info: Info[Context, None],
        labels: Optional[list[str]] = UNSET,
    ) -> list[ClassificationEvaluatorConfig]:
        pydantic_configs = get_classification_evaluator_configs(
            labels=labels if labels is not UNSET else None
        )

        gql_configs: list[ClassificationEvaluatorConfig] = []
        for config in pydantic_configs:
            if config.optimization_direction == "maximize":
                optimization_direction = OptimizationDirection.MAXIMIZE
            elif config.optimization_direction == "minimize":
                optimization_direction = OptimizationDirection.MINIMIZE
            else:
                optimization_direction = OptimizationDirection.NONE

            gql_messages: list[PromptMessage] = []
            for msg in config.messages:
                role_str = msg.role.lower()
                if role_str == "user":
                    role = PromptMessageRole.USER
                elif role_str == "system":
                    role = PromptMessageRole.SYSTEM
                elif role_str in ("ai", "assistant"):
                    role = PromptMessageRole.AI
                elif role_str == "tool":
                    role = PromptMessageRole.TOOL
                else:
                    # Default to USER if unknown role
                    role = PromptMessageRole.USER

                content = type_cast(
                    list[ContentPart],
                    [TextContentPart(text=TextContentValue(text=msg.content))],
                )

                gql_messages.append(PromptMessage(role=role, content=content))

            gql_config = ClassificationEvaluatorConfig(
                name=config.name,
                description=config.description,
                optimization_direction=optimization_direction,
                messages=gql_messages,
                choices=JSON(config.choices),
            )
            gql_configs.append(gql_config)

        return gql_configs

    @strawberry.field
    async def default_project_trace_retention_policy(
        self,
        info: Info[Context, None],
    ) -> ProjectTraceRetentionPolicy:
        stmt = select(models.ProjectTraceRetentionPolicy).filter_by(
            id=DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
        )
        async with info.context.db.read() as session:
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
        async with info.context.db.read() as session:
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
            async with info.context.db.read() as session:
                page_count = await session.scalar(text("PRAGMA page_count;"))
                free_pages = await session.scalar(text("PRAGMA freelist_count;"))
                page_size = await session.scalar(text("PRAGMA page_size;"))
            num_bytes = (page_count - free_pages) * page_size
            return [DbTableStats(table_name="SQLite", num_bytes=num_bytes)]
            # stmt = text("SELECT name, sum(pgsize) FROM dbstat group by name;")
            # async with info.context.db.read() as session:
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
                async with info.context.db.read() as session:
                    stats = type_cast(Iterable[tuple[str, int]], await session.execute(stmt))
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
    async def server_status(
        self,
        info: Info[Context, None],
    ) -> ServerStatus:
        return ServerStatus(
            insufficient_storage=info.context.db.should_not_insert_or_update,
        )

    @strawberry.field
    def agents_config(self, info: Info[Context, None]) -> AgentsConfig:
        agent_assistant_enabled = info.context.settings.agent_assistant_enabled
        trace_recording = info.context.settings.agent_trace_recording
        return AgentsConfig(
            collector_endpoint=get_env_phoenix_agents_collector_endpoint(),
            assistant_project_name=get_env_phoenix_agents_assistant_project_name(),
            web_access_enabled=get_env_phoenix_agents_web_access_enabled(),
            assistant_enabled=agent_assistant_enabled.enabled,
            allow_local_traces=trace_recording.allow_local_traces,
            allow_remote_export=trace_recording.allow_remote_export,
        )

    @strawberry.field(description="The assistant skills available given the supplied UI context.")  # type: ignore
    def available_agent_skills(
        self,
        info: Info[Context, None],
        input: Optional[AvailableAgentSkillsInput] = UNSET,
    ) -> list[AgentSkill]:
        from phoenix.server.agents.skills import get_skills

        resolved_input = input if input is not UNSET and input is not None else None
        skills = get_skills(
            has_playground_context=bool(resolved_input and resolved_input.has_playground_context),
            has_dataset_context=bool(resolved_input and resolved_input.has_dataset_context),
            has_llm_evaluator_context=bool(
                resolved_input and resolved_input.has_llm_evaluator_context
            ),
            has_code_evaluator_context=bool(
                resolved_input and resolved_input.has_code_evaluator_context
            ),
        )
        return [
            AgentSkill(
                name=skill.name,
                description=skill.description,
                summary=skill.summary,
            )
            for skill in skills
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
        async with info.context.db.read() as session:
            span_rowid = await session.scalar(stmt)
        # Unauthorized is indistinguishable from not-found: a span's access derives from
        # its project (containment).
        if span_rowid and await _containment_readable(info, "Span", span_rowid):
            return Span(id=span_rowid)
        return None

    @strawberry.field
    async def get_trace_by_otel_id(
        self,
        info: Info[Context, None],
        trace_id: str,
    ) -> Optional[Trace]:
        stmt = select(models.Trace.id).where(models.Trace.trace_id == trace_id)
        async with info.context.db.read() as session:
            trace_rowid = await session.scalar(stmt)
        if trace_rowid and await _containment_readable(info, "Trace", trace_rowid):
            return Trace(id=trace_rowid)
        return None

    @strawberry.field
    async def get_project_by_name(
        self,
        info: Info[Context, None],
        name: str,
    ) -> Optional[Project]:
        stmt = select(models.Project).where(models.Project.name == name)
        async with info.context.db.read() as session:
            project_row = await session.scalar(stmt)
            # Unauthorized is indistinguishable from not-found (no name oracle).
            if project_row is not None:
                scope = await info.context.access_scope(session, OBJECT_TYPE_PROJECT)
                if not scope.allows(project_row.id):
                    return None
        if project_row:
            return Project(id=project_row.id, db_record=project_row)
        return None

    @strawberry.field
    async def get_project_session_by_id(
        self,
        info: Info[Context, None],
        session_id: str,
    ) -> Optional[ProjectSession]:
        stmt = select(models.ProjectSession).where(models.ProjectSession.session_id == session_id)
        async with info.context.db.read() as session:
            session_row = await session.scalar(stmt)
        if session_row and await _containment_readable(info, "ProjectSession", session_row.id):
            return ProjectSession(id=session_row.id, db_record=session_row)
        return None

    @strawberry.field
    async def get_dataset_example_by_external_id(
        self,
        info: Info[Context, None],
        dataset_id: GlobalID,
        external_id: str,
    ) -> Optional[DatasetExample]:
        dataset_rowid = from_global_id_with_expected_type(
            global_id=dataset_id, expected_type_name="Dataset"
        )
        stmt = select(models.DatasetExample).where(
            models.DatasetExample.dataset_id == dataset_rowid,
            models.DatasetExample.external_id == external_id,
        )
        async with info.context.db() as session:
            example = await session.scalar(stmt)
        # A dataset example's access derives from its dataset (access-by-parent).
        if example and await _eval_readable(info, "DatasetExample", example.id):
            return DatasetExample(id=example.id, db_record=example)
        return None

    @strawberry.field
    async def apply_chat_template(
        self,
        template: PromptChatTemplateInput,
        template_options: PromptTemplateOptions,
        input_mapping: Optional[EvaluatorInputMappingInput] = None,
    ) -> PromptChatTemplate:
        """
        Applies template formatting to a prompt chat template.

        Takes a template with messages containing template placeholders and template options
        (format and variables), and returns the messages with placeholders replaced.
        """
        formatter = get_template_formatter(template_options.format)
        # Ensure variables is a dict - JSON scalar can be any JSON type
        raw_variables = template_options.variables
        variables: dict[str, Any]
        if isinstance(raw_variables, dict):
            variables = raw_variables
        elif isinstance(raw_variables, str):
            parsed = json.loads(raw_variables)
            if not isinstance(parsed, dict):
                raise BadRequest("Variables JSON string must parse to a dictionary")
            variables = parsed
        else:
            raise BadRequest("Variables must be a dictionary or a string")

        if input_mapping:
            input_schema = infer_input_schema_from_template(
                template=template,
                template_format=template_options.format,
            )

            try:
                variables = apply_input_mapping(
                    input_schema=input_schema,
                    input_mapping=input_mapping.to_orm(),
                    context=variables,
                )
            except ValueError as error:
                raise BadRequest(str(error))

            variables = cast_template_variable_types(
                template_variables=variables,
                input_schema=input_schema,
            )

            try:
                validate_template_variables(
                    template_variables=variables,
                    input_schema=input_schema,
                )
            except ValueError as error:
                raise BadRequest(str(error))

        messages: list[PromptMessage] = []
        for msg in template.messages:
            content_parts: list[ContentPart] = []
            for part in msg.content:
                if part.text is not UNSET:
                    assert part.text is not None
                    try:
                        formatted_text = formatter.format(part.text.text, **variables)
                    except TemplateFormatterError as error:
                        raise BadRequest(str(error))
                    content_parts.append(
                        TextContentPart(text=TextContentValue(text=formatted_text))
                    )
                elif part.tool_call is not UNSET:
                    assert part.tool_call is not None
                    tc = part.tool_call
                    content_parts.append(
                        ToolCallContentPart(
                            tool_call=ToolCallContentValue(
                                tool_call_id=tc.tool_call_id,
                                tool_call=ToolCallFunction(
                                    name=tc.tool_call.name,
                                    arguments=tc.tool_call.arguments,
                                ),
                            )
                        )
                    )
                elif part.tool_result is not UNSET:
                    assert part.tool_result is not None
                    tr = part.tool_result
                    content_parts.append(
                        ToolResultContentPart(
                            tool_result=ToolResultContentValue(
                                tool_call_id=tr.tool_call_id,
                                result=tr.result,
                            )
                        )
                    )
            messages.append(PromptMessage(role=PromptMessageRole(msg.role), content=content_parts))

        return PromptChatTemplate(messages=messages)

    @strawberry.field
    async def project_count(self, info: Info[Context, None]) -> int:
        stmt = select(func.count(models.Project.id))
        stmt = exclude_experiment_projects(stmt)
        stmt = exclude_dataset_evaluator_projects(stmt)
        async with info.context.db.read() as session:
            stmt = stmt.where(
                await info.context.access_filter(session, OBJECT_TYPE_PROJECT, models.Project.id)
            )
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def dataset_count(self, info: Info[Context, None]) -> int:
        async with info.context.db.read() as session:
            stmt = select(func.count(models.Dataset.id)).where(
                await info.context.access_filter(session, OBJECT_TYPE_DATASET, models.Dataset.id)
            )
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def prompt_count(self, info: Info[Context, None]) -> int:
        async with info.context.db.read() as session:
            stmt = select(func.count(models.Prompt.id)).where(
                await info.context.access_filter(session, OBJECT_TYPE_PROMPT, models.Prompt.id)
            )
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def evaluator_count(self, info: Info[Context, None]) -> int:
        has_dataset_association = exists(
            select(models.DatasetEvaluators.id).where(
                models.DatasetEvaluators.evaluator_id == models.Evaluator.id
            )
        )
        stmt = select(func.count(models.Evaluator.id)).where(
            or_(
                models.Evaluator.kind != "BUILTIN",
                has_dataset_association,
            )
        )
        async with info.context.db.read() as session:
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def sandbox_backends(self, info: Info[Context, None]) -> list[SandboxBackendInfo]:
        """Return static + runtime info for all known sandbox backends."""
        from phoenix.server.sandbox import SecretsContext

        async with info.context.db.read() as session:
            return await get_sandbox_backend_info(
                secrets=SecretsContext(session=session, decrypt=info.context.decrypt),
            )

    @strawberry.field
    async def sandbox_providers(self, info: Info[Context, None]) -> list[SandboxProvider]:
        """Return all persisted sandbox providers with their nested configs."""
        stmt = select(models.SandboxProvider).order_by(models.SandboxProvider.backend_type.asc())
        async with info.context.db.read() as session:
            rows = (await session.scalars(stmt)).all()
        return [SandboxProvider(id=row.backend_type, db_record=row) for row in rows]


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


def _comparison_count_expression(
    *,
    base_column: ColumnElement[Any],
    compare_column: ColumnElement[Any],
    optimization_direction: Literal["maximize", "minimize"],
    comparison_type: Literal["improvement", "regression", "equality"],
) -> ColumnElement[int]:
    """
    Given a base and compare column, returns an expression counting the number of
    improvements, regressions, or equalities given the optimization direction.
    """
    if optimization_direction == "maximize":
        raise NotImplementedError

    if comparison_type == "improvement":
        condition = compare_column > base_column
    elif comparison_type == "regression":
        condition = compare_column < base_column
    elif comparison_type == "equality":
        condition = compare_column == base_column
    else:
        assert_never(comparison_type)

    return func.coalesce(
        func.sum(
            case(
                (
                    condition,
                    1,
                ),
                else_=0,
            )
        ),
        0,
    )
