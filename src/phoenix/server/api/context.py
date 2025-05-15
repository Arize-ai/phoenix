from asyncio import get_running_loop
from dataclasses import dataclass
from functools import cached_property, partial
from pathlib import Path
from typing import Any, Optional, cast

from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse
from strawberry.fastapi import BaseContext

from phoenix.auth import (
    compute_password_hash,
)
from phoenix.core.model_schema import Model
from phoenix.db import models
from phoenix.server.api.dataloaders import (
    AnnotationSummaryDataLoader,
    AverageExperimentRunLatencyDataLoader,
    CacheForDataLoaders,
    DatasetExampleRevisionsDataLoader,
    DatasetExampleSpansDataLoader,
    DocumentEvaluationsDataLoader,
    DocumentEvaluationSummaryDataLoader,
    DocumentRetrievalMetricsDataLoader,
    ExperimentAnnotationSummaryDataLoader,
    ExperimentErrorRatesDataLoader,
    ExperimentRunAnnotations,
    ExperimentRunCountsDataLoader,
    ExperimentSequenceNumberDataLoader,
    LatencyMsQuantileDataLoader,
    MinStartOrMaxEndTimeDataLoader,
    NumChildSpansDataLoader,
    NumSpansPerTraceDataLoader,
    ProjectByNameDataLoader,
    ProjectIdsByTraceRetentionPolicyIdDataLoader,
    PromptVersionSequenceNumberDataLoader,
    RecordCountDataLoader,
    SessionIODataLoader,
    SessionNumTracesDataLoader,
    SessionNumTracesWithErrorDataLoader,
    SessionTokenUsagesDataLoader,
    SessionTraceLatencyMsQuantileDataLoader,
    SpanAnnotationsDataLoader,
    SpanByIdDataLoader,
    SpanDatasetExamplesDataLoader,
    SpanDescendantsDataLoader,
    SpanProjectsDataLoader,
    TableFieldsDataLoader,
    TokenCountDataLoader,
    TraceByTraceIdsDataLoader,
    TraceRetentionPolicyIdByProjectIdDataLoader,
    TraceRootSpansDataLoader,
    UserRolesDataLoader,
    UsersDataLoader,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DmlEvent
from phoenix.server.email.types import EmailSender
from phoenix.server.types import (
    CanGetLastUpdatedAt,
    CanPutItem,
    DbSessionFactory,
    TokenStore,
    UserId,
)


@dataclass
class DataLoaders:
    average_experiment_run_latency: AverageExperimentRunLatencyDataLoader
    dataset_example_revisions: DatasetExampleRevisionsDataLoader
    dataset_example_spans: DatasetExampleSpansDataLoader
    document_evaluation_summaries: DocumentEvaluationSummaryDataLoader
    document_evaluations: DocumentEvaluationsDataLoader
    document_retrieval_metrics: DocumentRetrievalMetricsDataLoader
    annotation_summaries: AnnotationSummaryDataLoader
    experiment_annotation_summaries: ExperimentAnnotationSummaryDataLoader
    experiment_error_rates: ExperimentErrorRatesDataLoader
    experiment_run_annotations: ExperimentRunAnnotations
    experiment_run_counts: ExperimentRunCountsDataLoader
    experiment_sequence_number: ExperimentSequenceNumberDataLoader
    latency_ms_quantile: LatencyMsQuantileDataLoader
    min_start_or_max_end_times: MinStartOrMaxEndTimeDataLoader
    num_child_spans: NumChildSpansDataLoader
    num_spans_per_trace: NumSpansPerTraceDataLoader
    project_fields: TableFieldsDataLoader
    projects_by_trace_retention_policy_id: ProjectIdsByTraceRetentionPolicyIdDataLoader
    prompt_version_sequence_number: PromptVersionSequenceNumberDataLoader
    record_counts: RecordCountDataLoader
    session_first_inputs: SessionIODataLoader
    session_last_outputs: SessionIODataLoader
    session_num_traces: SessionNumTracesDataLoader
    session_num_traces_with_error: SessionNumTracesWithErrorDataLoader
    session_token_usages: SessionTokenUsagesDataLoader
    session_trace_latency_ms_quantile: SessionTraceLatencyMsQuantileDataLoader
    span_annotations: SpanAnnotationsDataLoader
    span_by_id: SpanByIdDataLoader
    span_dataset_examples: SpanDatasetExamplesDataLoader
    span_descendants: SpanDescendantsDataLoader
    span_fields: TableFieldsDataLoader
    span_projects: SpanProjectsDataLoader
    token_counts: TokenCountDataLoader
    trace_by_trace_ids: TraceByTraceIdsDataLoader
    trace_fields: TableFieldsDataLoader
    trace_retention_policy_id_by_project_id: TraceRetentionPolicyIdByProjectIdDataLoader
    project_trace_retention_policy_fields: TableFieldsDataLoader
    trace_root_spans: TraceRootSpansDataLoader
    project_by_name: ProjectByNameDataLoader
    users: UsersDataLoader
    user_roles: UserRolesDataLoader


class _NoOp:
    def get(self, *args: Any, **kwargs: Any) -> Any: ...
    def put(self, *args: Any, **kwargs: Any) -> Any: ...


@dataclass
class Context(BaseContext):
    db: DbSessionFactory
    data_loaders: DataLoaders
    cache_for_dataloaders: Optional[CacheForDataLoaders]
    model: Model
    export_path: Path
    last_updated_at: CanGetLastUpdatedAt = _NoOp()
    event_queue: CanPutItem[DmlEvent] = _NoOp()
    corpus: Optional[Model] = None
    read_only: bool = False
    locked: bool = False
    auth_enabled: bool = False
    secret: Optional[str] = None
    token_store: Optional[TokenStore] = None
    email_sender: Optional[EmailSender] = None

    def get_secret(self) -> str:
        """A type-safe way to get the application secret. Throws an error if the secret is not set.

        Returns:
            str: the phoenix secret
        """
        if self.secret is None:
            raise ValueError(
                "Application secret not set."
                " Please set the PHOENIX_SECRET environment variable and re-deploy the application."
            )
        return self.secret

    def get_request(self) -> StarletteRequest:
        """
        A type-safe way to get the request object. Throws an error if the request is not set.
        """
        if not isinstance(request := self.request, StarletteRequest):
            raise ValueError("no request is set")
        return request

    def get_response(self) -> StarletteResponse:
        """
        A type-safe way to get the response object. Throws an error if the response is not set.
        """
        if (response := self.response) is None:
            raise ValueError("no response is set")
        return response

    async def is_valid_password(self, password: str, user: models.User) -> bool:
        return (
            (hash_ := user.password_hash) is not None
            and (salt := user.password_salt) is not None
            and hash_ == await self.hash_password(password, salt)
        )

    @staticmethod
    async def hash_password(password: str, salt: bytes) -> bytes:
        compute = partial(compute_password_hash, password=password, salt=salt)
        return await get_running_loop().run_in_executor(None, compute)

    async def log_out(self, user_id: int) -> None:
        assert self.token_store is not None
        await self.token_store.log_out(UserId(user_id))

    @cached_property
    def user(self) -> PhoenixUser:
        return cast(PhoenixUser, self.get_request().user)
