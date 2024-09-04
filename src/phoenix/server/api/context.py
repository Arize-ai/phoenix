from asyncio import get_running_loop
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from typing import Any, Optional

from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse
from strawberry.fastapi import BaseContext

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_ACCESS_TOKEN_MAX_AGE,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_MAX_AGE,
    compute_password_hash,
)
from phoenix.core.model_schema import Model
from phoenix.db import enums, models
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
    ProjectByNameDataLoader,
    RecordCountDataLoader,
    SpanAnnotationsDataLoader,
    SpanDatasetExamplesDataLoader,
    SpanDescendantsDataLoader,
    SpanProjectsDataLoader,
    TokenCountDataLoader,
    TraceRowIdsDataLoader,
    UserRolesDataLoader,
    UsersDataLoader,
)
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    CanGetLastUpdatedAt,
    CanPutItem,
    DbSessionFactory,
    RefreshTokenAttributes,
    RefreshTokenClaims,
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
    record_counts: RecordCountDataLoader
    span_annotations: SpanAnnotationsDataLoader
    span_dataset_examples: SpanDatasetExamplesDataLoader
    span_descendants: SpanDescendantsDataLoader
    span_projects: SpanProjectsDataLoader
    token_counts: TokenCountDataLoader
    trace_row_ids: TraceRowIdsDataLoader
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
    secret: Optional[str] = None
    token_store: Optional[TokenStore] = None

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

    async def is_valid_password(self, password: str, hash_: bytes, /, *, salt: bytes) -> bool:
        return hash_ == await self.hash_password(password, salt)

    @staticmethod
    async def hash_password(password: str, salt: bytes) -> bytes:
        return await get_running_loop().run_in_executor(
            None, partial(compute_password_hash, password=password, salt=salt)
        )

    async def log_out(self, user_id: int) -> None:
        assert self.token_store is not None
        await self.token_store.log_out(UserId(user_id))
        response = self.get_response()
        response.delete_cookie(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)
        response.delete_cookie(PHOENIX_ACCESS_TOKEN_COOKIE_NAME)

    async def log_in(self, user: models.User) -> None:
        assert self.token_store is not None
        issued_at = datetime.now(timezone.utc)
        refresh_token_claims = RefreshTokenClaims(
            subject=UserId(user.id),
            issued_at=issued_at,
            expiration_time=issued_at + PHOENIX_REFRESH_TOKEN_MAX_AGE,
            attributes=RefreshTokenAttributes(
                user_role=enums.UserRole(user.role.name),
            ),
        )
        refresh_token, refresh_token_id = await self.token_store.create_refresh_token(
            refresh_token_claims
        )
        access_token_claims = AccessTokenClaims(
            subject=UserId(user.id),
            issued_at=issued_at,
            expiration_time=issued_at + PHOENIX_ACCESS_TOKEN_MAX_AGE,
            attributes=AccessTokenAttributes(
                user_role=enums.UserRole(user.role.name),
                refresh_token_id=refresh_token_id,
            ),
        )
        access_token, _ = await self.token_store.create_access_token(access_token_claims)
        response = self.get_response()
        response.set_cookie(
            key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            max_age=int(PHOENIX_ACCESS_TOKEN_MAX_AGE.total_seconds()),
            secure=True,
            httponly=True,
            samesite="strict",
        )
        response.set_cookie(
            key=PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            max_age=int(PHOENIX_REFRESH_TOKEN_MAX_AGE.total_seconds()),
            secure=True,
            httponly=True,
            samesite="strict",
        )
