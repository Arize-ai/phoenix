import json
import re
from collections import defaultdict
from datetime import datetime
from secrets import token_hex
from typing import Any, Iterable, Iterator, Literal, Optional, Union
from typing import cast as type_cast

import anyio
import numpy as np
import numpy.typing as npt
import strawberry
from sqlalchemy import ColumnElement, String, and_, case, cast, func, select, text
from sqlalchemy.orm import joinedload, load_only, with_polymorphic
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
from phoenix.db.helpers import (
    SupportedSQLDialect,
    exclude_experiment_projects,
)
from phoenix.db.models import LatencyMs
from phoenix.db.types.annotation_configs import OptimizationDirection
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.server.api.auth import MSG_ADMIN_ONLY, IsAdmin
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    apply_input_mapping,
    cast_template_variable_types,
    get_builtin_evaluators,
    infer_input_schema_from_template,
    validate_template_variables,
)
from phoenix.server.api.exceptions import BadRequest, NotFound, Unauthorized
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.helpers.classification_evaluator_configs import (
    get_classification_evaluator_configs,
)
from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionSyntaxError,
    compile_sqlalchemy_filter_condition,
    update_examples_query_with_filter_condition,
)
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.helpers.prompts.models import PromptMessageRole
from phoenix.server.api.helpers.prompts.template_helpers import get_template_formatter
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.input_types.Coordinates import InputCoordinate2D, InputCoordinate3D
from phoenix.server.api.input_types.DatasetFilter import DatasetFilter
from phoenix.server.api.input_types.DatasetSort import DatasetSort
from phoenix.server.api.input_types.EvaluatorFilter import EvaluatorFilter
from phoenix.server.api.input_types.EvaluatorSort import EvaluatorSort
from phoenix.server.api.input_types.GenerativeModelCustomerProviderConfigInput import (
    GenerativeModelCustomerProviderConfigInput,
)
from phoenix.server.api.input_types.InvocationParameters import InvocationParameter
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.ProjectFilter import ProjectFilter
from phoenix.server.api.input_types.ProjectSort import ProjectColumn, ProjectSort
from phoenix.server.api.input_types.PromptFilter import PromptFilter
from phoenix.server.api.input_types.PromptTemplateOptions import PromptTemplateOptions
from phoenix.server.api.input_types.PromptVersionInput import PromptChatTemplateInput
from phoenix.server.api.types.AnnotationConfig import AnnotationConfig, to_gql_annotation_config
from phoenix.server.api.types.ClassificationEvaluatorConfig import ClassificationEvaluatorConfig
from phoenix.server.api.types.Cluster import Cluster, to_gql_clusters
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetLabel import DatasetLabel
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.Dimension import to_gql_dimension
from phoenix.server.api.types.EmbeddingDimension import (
    DEFAULT_CLUSTER_SELECTION_EPSILON,
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    to_gql_embedding_dimension,
)
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    CodeEvaluator,
    DatasetEvaluator,
    Evaluator,
    LLMEvaluator,
)
from phoenix.server.api.types.Event import create_event_id, unpack_event_id
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.ExperimentComparison import (
    ExperimentComparison,
)
from phoenix.server.api.types.ExperimentRepeatedRunGroup import (
    ExperimentRepeatedRunGroup,
    parse_experiment_repeated_run_group_node_id,
)
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.Functionality import Functionality
from phoenix.server.api.types.GenerativeModel import GenerativeModel
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey
from phoenix.server.api.types.InferenceModel import InferenceModel
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole
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
    )  # type: ignore[misc]
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


@strawberry.type
class TestGenerativeModelCustomProviderCredentialsResult:
    error: str | None = None


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

        async with info.context.db() as session:
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
        async with info.context.db() as session:
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
    async def test_generative_model_custom_provider_credentials(
        self,
        input: GenerativeModelCustomerProviderConfigInput,
    ) -> TestGenerativeModelCustomProviderCredentialsResult:
        """
        Test provider credentials by making a lightweight API call.
        Uses models.list() where available, or a dummy model name where
        non-auth errors indicate valid credentials.
        """
        config = input.to_orm()

        if config.root.type == "openai":
            try:
                openai_client = config.root.get_client()
                with anyio.move_on_after(10) as scope:
                    await openai_client.models.list(timeout=10)
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
        elif config.root.type == "azure_openai":
            try:
                azure_openai_client = config.root.get_client()
                with anyio.move_on_after(10) as scope:
                    await azure_openai_client.models.list(timeout=10)
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
        elif config.root.type == "anthropic":
            try:
                from anthropic import NotFoundError as AnthropicNotFoundError

                anthropic_client = config.root.get_client()
                # Use dummy model - non-auth errors mean credentials are valid
                with anyio.move_on_after(10) as scope:
                    await anthropic_client.messages.create(
                        model="test-credential-check",
                        messages=[{"role": "user", "content": "Hi"}],
                        max_tokens=10,
                        timeout=10,
                    )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except AnthropicNotFoundError:
                pass  # Fall through to return VALID
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
        elif config.root.type == "aws_bedrock":
            try:
                from botocore.exceptions import ClientError  # type: ignore[import-untyped]
                from starlette.concurrency import run_in_threadpool

                aws_bedrock_client = config.root.get_client()
                # Use dummy model - ValidationException means credentials are valid
                # boto3 is synchronous, run in thread pool
                with anyio.move_on_after(10) as scope:
                    await run_in_threadpool(
                        aws_bedrock_client.converse,
                        modelId=f"test-credential-check-{token_hex(4)}",
                        messages=[{"role": "user", "content": [{"text": "Hi"}]}],
                        inferenceConfig={"maxTokens": 10},
                    )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                # ValidationException means credentials are valid but model ID is wrong
                # This is still a successful credential test
                if error_code == "ValidationException":
                    pass  # Fall through to return VALID
                else:
                    return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
        elif config.root.type == "google_genai":
            try:
                from google.genai.types import HttpOptions, ListModelsConfig

                google_genai_client = config.root.get_client()
                with anyio.move_on_after(10) as scope:
                    await google_genai_client.models.list(
                        config=ListModelsConfig(http_options=HttpOptions(timeout=10_000))
                    )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(error=str(e))
        else:
            raise BadRequest("Invalid input")
        return TestGenerativeModelCustomProviderCredentialsResult(error=None)

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
        async with info.context.db() as session:
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
            data = [User(id=user.id, db_record=user) async for user in users]
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
        return [UserApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

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
            data = [Project(id=project.id, db_record=project) async for project in projects]
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
        async with info.context.db() as session:
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

        cursor = Cursor.from_string(after) if after else None
        page_size = first or 50

        async with info.context.db() as session:
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
                .order_by(models.DatasetExample.id.desc())
                .limit(page_size + 1)
            )

            if cursor is not None:
                examples_query = examples_query.where(models.DatasetExample.id < cursor.rowid)

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

        async with info.context.db() as session:
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
    async def functionality(self, info: Info[Context, None]) -> "Functionality":
        has_model_inferences = not info.context.model.is_empty
        return Functionality(
            model_inferences=has_model_inferences,
        )

    @strawberry.field
    def model(self) -> InferenceModel:
        return InferenceModel()

    @strawberry.field
    async def node(self, id: strawberry.ID, info: Info[Context, None]) -> Node:
        if is_composite_global_id(id):
            try:
                experiment_rowid, dataset_example_rowid = (
                    parse_experiment_repeated_run_group_node_id(id)
                )
            except Exception:
                raise NotFound(f"Unknown node: {id}")
            return ExperimentRepeatedRunGroup(
                experiment_rowid=experiment_rowid,
                dataset_example_rowid=dataset_example_rowid,
            )

        global_id = GlobalID.from_id(id)
        type_name = global_id.type_name
        if type_name == Secret.__name__:
            return Secret(id=global_id.node_id)
        node_id = int(global_id.node_id)
        if type_name == "Dimension":
            dimension = info.context.model.scalar_dimensions[node_id]
            return to_gql_dimension(node_id, dimension)
        elif type_name == "EmbeddingDimension":
            embedding_dimension = info.context.model.embedding_dimensions[node_id]
            return to_gql_embedding_dimension(node_id, embedding_dimension)
        elif type_name == Project.__name__:
            return Project(id=node_id)
        elif type_name == Trace.__name__:
            return Trace(id=node_id)
        elif type_name == Span.__name__:
            return Span(id=node_id)
        elif type_name == Dataset.__name__:
            return Dataset(id=node_id)
        elif type_name == DatasetExample.__name__:
            return DatasetExample(id=node_id)
        elif type_name == DatasetSplit.__name__:
            return DatasetSplit(id=node_id)
        elif type_name == Experiment.__name__:
            return Experiment(id=node_id)
        elif type_name == ExperimentRun.__name__:
            return ExperimentRun(id=node_id)
        elif type_name == User.__name__:
            if int((user := info.context.user).identity) != node_id and not user.is_admin:
                raise Unauthorized(MSG_ADMIN_ONLY)
            return User(id=node_id)
        elif type_name == ProjectSession.__name__:
            return ProjectSession(id=node_id)
        elif type_name == Prompt.__name__:
            return Prompt(id=node_id)
        elif type_name == PromptVersion.__name__:
            async with info.context.db() as session:
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
            return SpanAnnotation(id=node_id)
        elif type_name == TraceAnnotation.__name__:
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
        stmt = select(models.Prompt)
        if filter:
            column = getattr(models.Prompt, filter.col.value)
            # Cast Identifier columns to String for ilike operations
            if filter.col.value == "name":
                column = cast(column, String)
            stmt = stmt.where(column.ilike(f"%{filter.value}%")).order_by(
                models.Prompt.updated_at.desc()
            )
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
        async with info.context.db() as session:
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
        async with info.context.db() as session:
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
    ) -> Connection[DatasetLabel]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            dataset_labels = await session.scalars(
                select(models.DatasetLabel).order_by(models.DatasetLabel.name.asc())
            )
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
    ) -> Connection[DatasetSplit]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            splits = await session.stream_scalars(select(models.DatasetSplit))
            data = [DatasetSplit(id=split.id, db_record=split) async for split in splits]
            return connection_from_list(
                data=data,
                args=args,
            )

    @strawberry.field
    async def built_in_evaluators(self) -> list[BuiltInEvaluator]:
        return [BuiltInEvaluator(id=builtin_id) for builtin_id, _ in get_builtin_evaluators()]

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
            models.Evaluator, [models.LLMEvaluator, models.CodeEvaluator]
        )  # eagerly join sub-classed evaluator tables
        query = select(PolymorphicEvaluator)

        if filter:
            column = getattr(PolymorphicEvaluator, filter.col.value)
            # Cast Identifier columns to String for ilike operations
            if filter.col.value == "name":
                column = cast(column, String)
            query = query.where(column.ilike(f"%{filter.value}%"))

        if sort:
            if sort.col.value == "updated_at":
                # updated_at exists in sub-tables, not base table
                # Use case to pick the value based on kind
                # this special case can be removed if we add updated_at to the base table
                sort_col = case(
                    (PolymorphicEvaluator.kind == "LLM", models.LLMEvaluator.updated_at),
                    (PolymorphicEvaluator.kind == "CODE", models.CodeEvaluator.updated_at),
                    else_=None,
                )
            else:
                sort_col = getattr(PolymorphicEvaluator, sort.col.value)
            query = query.order_by(sort_col.desc() if sort.dir is SortDir.desc else sort_col.asc())
        else:
            query = query.order_by(PolymorphicEvaluator.name.asc())

        async with info.context.db() as session:
            evaluators = await session.scalars(query)
        data: list[Evaluator] = []
        for evaluator in evaluators:
            if isinstance(evaluator, models.LLMEvaluator):
                data.append(LLMEvaluator(id=evaluator.id, db_record=evaluator))
            elif isinstance(evaluator, models.CodeEvaluator):
                data.append(CodeEvaluator(id=evaluator.id, db_record=evaluator))
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
        async with info.context.db() as session:
            configs = await session.stream_scalars(
                select(models.AnnotationConfig).order_by(models.AnnotationConfig.name)
            )
            data = [to_gql_annotation_config(config) async for config in configs]
            return connection_from_list(data=data, args=args)

    @strawberry.field
    async def classification_evaluator_configs(
        self,
        info: Info[Context, None],
    ) -> list[ClassificationEvaluatorConfig]:
        pydantic_configs = get_classification_evaluator_configs()

        gql_configs: list[ClassificationEvaluatorConfig] = []
        for config in pydantic_configs:
            optimization_direction = (
                OptimizationDirection.MAXIMIZE
                if config.optimization_direction == "maximize"
                else OptimizationDirection.MINIMIZE
            )

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
                choices=config.choices,
            )
            gql_configs.append(gql_config)

        return gql_configs

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
            return Span(id=span_rowid)
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
            return Trace(id=trace_rowid)
        return None

    @strawberry.field
    async def get_project_session_by_id(
        self,
        info: Info[Context, None],
        session_id: str,
    ) -> Optional[ProjectSession]:
        stmt = select(models.ProjectSession).where(models.ProjectSession.session_id == session_id)
        async with info.context.db() as session:
            session_row = await session.scalar(stmt)
        if session_row:
            return ProjectSession(id=session_row.id, db_record=session_row)
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
        if isinstance(raw_variables, dict):
            variables = raw_variables
        elif isinstance(raw_variables, str):
            parsed = json.loads(raw_variables)
            if not isinstance(parsed, dict):
                raise ValueError("Variables JSON string must parse to a dictionary")
            variables = parsed
        else:
            raise ValueError("Variables must be a dictionary or a string")

        if input_mapping:
            input_schema = infer_input_schema_from_template(
                template=template,
                template_format=template_options.format,
            )
            variables = apply_input_mapping(
                input_schema=input_schema,
                input_mapping=input_mapping,
                context=variables,
            )
            variables = cast_template_variable_types(
                template_variables=variables,
                input_schema=input_schema,
            )
            validate_template_variables(
                template_variables=variables,
                input_schema=input_schema,
            )

        messages: list[PromptMessage] = []
        for msg in template.messages:
            content_parts: list[ContentPart] = []
            for part in msg.content:
                if part.text is not UNSET:
                    assert part.text is not None
                    formatted_text = formatter.format(part.text.text, **variables)
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
