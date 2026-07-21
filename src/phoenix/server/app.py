import asyncio
import contextlib
import importlib
import json
import logging
import mimetypes
import os
from contextlib import AbstractAsyncContextManager, AsyncExitStack
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import cached_property
from pathlib import Path
from types import MethodType
from typing import (
    TYPE_CHECKING,
    Any,
    AsyncIterator,
    Awaitable,
    Callable,
    Iterable,
    NamedTuple,
    Optional,
    Protocol,
    Sequence,
    TypedDict,
    Union,
    cast,
)
from urllib.parse import urlparse

import grpc
import strawberry
from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.utils import is_body_allowed_for_status_code
from grpc.aio import ServerInterceptor
from grpc_interceptor import AsyncServerInterceptor
from pydantic import SecretStr
from pydantic_ai.mcp import MCPToolset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from starlette.authentication import UnauthenticatedUser
from starlette.datastructures import URL
from starlette.datastructures import State as StarletteState
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from starlette.types import Scope, StatefulLifespan
from strawberry.extensions import MaxAliasesLimiter, QueryDepthLimiter, SchemaExtension
from strawberry.fastapi import GraphQLRouter
from typing_extensions import TypeAlias, override

from phoenix.config import (
    DEFAULT_PROJECT_NAME,
    ENV_PHOENIX_CSRF_TRUSTED_ORIGINS,
    SERVER_DIR,
    OAuth2ClientConfig,
    get_env_allow_external_resources,
    get_env_allowed_providers,
    get_env_csrf_trusted_origins,
    get_env_database_allocated_storage_capacity_gibibytes,
    get_env_database_usage_insertion_blocking_threshold_percentage,
    get_env_disable_agent_assistant,
    get_env_fastapi_middleware_paths,
    get_env_gql_extension_paths,
    get_env_grpc_interceptor_paths,
    get_env_grpc_port,
    get_env_host,
    get_env_max_spans_queue_size,
    get_env_online_eval_enabled,
    get_env_phoenix_agents_disable_bash,
    get_env_port,
    get_env_support_email,
    server_instrumentation_is_enabled,
    verify_server_environment_variables,
)
from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.facilitator import Facilitator
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.types import AnnotationPrecursor
from phoenix.server.agents.capabilities import MintlifyDocsMCPServer
from phoenix.server.api.auth_messages import AUTH_ERROR_MESSAGES, AuthErrorCode
from phoenix.server.api.context import Context, build_context
from phoenix.server.api.dataloaders import CacheForDataLoaders
from phoenix.server.api.routers import (
    create_agents_router,
    create_auth_router,
    create_v1_router,
    oauth2_router,
)
from phoenix.server.api.routers.v1 import REST_API_VERSION
from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.bearer_auth import BearerTokenAuthBackend, PhoenixUser, is_authenticated
from phoenix.server.daemons.db_disk_usage_monitor import DbDiskUsageMonitor
from phoenix.server.daemons.experiment_runner import ExperimentRunner
from phoenix.server.daemons.experiment_sweeper import ExperimentSweeper
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.dml_event import DmlEvent
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.email.types import EmailSender
from phoenix.server.encryption import EncryptionService
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.jwt_store import JwtStore
from phoenix.server.middleware.gzip import GZipMiddleware
from phoenix.server.oauth2 import OAuth2Clients
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.prometheus import SPAN_QUEUE_REJECTIONS
from phoenix.server.redaction import Redactor, current_redactor
from phoenix.server.retention import TraceDataSweeper
from phoenix.server.sandbox._download import prefetch_wasm_binary_if_needed
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.settings.registry import SETTINGS_REGISTRY
from phoenix.server.telemetry import initialize_opentelemetry_tracer_provider
from phoenix.server.types import (
    CanGetLastUpdatedAt,
    CanPutItem,
    DaemonTask,
    DbSessionFactory,
    LastUpdatedAt,
    TokenStore,
)
from phoenix.server.utils import get_root_path, prepend_root_path
from phoenix.settings import Settings
from phoenix.trace.fixtures import (
    TracesFixture,
    get_annotation_precursors_from_fixture,
    get_dataset_fixtures,
    get_trace_fixture_by_name,
    load_example_traces,
    remap_precursor_ids,
    reset_fixture_span_ids_and_timestamps,
    send_dataset_fixtures,
)
from phoenix.trace.otel import decode_otlp_span, encode_span_to_otlp
from phoenix.trace.schemas import Span
from phoenix.tracers import Tracer
from phoenix.utilities.client import PHOENIX_SERVER_VERSION_HEADER
from phoenix.version import __version__ as phoenix_version

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

    from phoenix.config import LDAPConfig

# Fix incorrect MIME types on Windows where the registry may have wrong entries.
# See: https://github.com/python/cpython/issues/88141
# Using text/javascript per RFC 9239: https://www.rfc-editor.org/rfc/rfc9239
mimetypes.add_type("text/javascript", ".js", strict=True)
mimetypes.add_type("text/javascript", ".mjs", strict=True)

logger = logging.getLogger(__name__)

router = APIRouter()

templates = Jinja2Templates(directory=SERVER_DIR / "templates")

"""
Threshold (in minutes) to determine if database is booted up for the first time.

Used to assess whether the `default` project was created recently.
If so, demo data is automatically ingested upon initial boot up to populate the database.
"""
NEW_DB_AGE_THRESHOLD_MINUTES = 2

ProjectName: TypeAlias = str
_Callback: TypeAlias = Callable[[], Union[None, Awaitable[None]]]


def import_object_from_file(file_path: str, object_name: str) -> Any:
    """Import an object (class or function) from a Python file."""
    try:
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File '{file_path}' does not exist.")
        module_name = f"custom_module_{hash(file_path)}"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None:
            raise ImportError(f"Could not load spec for '{file_path}'")
        module = importlib.util.module_from_spec(spec)
        loader = spec.loader
        if loader is None:
            raise ImportError(f"No loader found for '{file_path}'")
        loader.exec_module(module)
        try:
            return getattr(module, object_name)
        except AttributeError:
            raise ImportError(f"Module '{file_path}' does not have an object '{object_name}'.")
    except Exception as e:
        raise ImportError(f"Could not import '{object_name}' from '{file_path}': {e}")


class OAuth2Idp(TypedDict):
    name: str
    displayName: str


class AppConfig(NamedTuple):
    is_development: bool
    web_manifest_path: Path
    authentication_enabled: bool
    """ Whether authentication is enabled """
    auth_error_messages: dict[AuthErrorCode, str]
    """ Mapping of auth error codes to user-friendly messages """
    oauth2_idps: Sequence[OAuth2Idp]
    basic_auth_disabled: bool = False
    ldap_enabled: bool = False
    """ Whether LDAP authentication is configured """
    ldap_manual_user_creation_enabled: bool = False
    """ Whether manual LDAP user creation is allowed (False when LDAP disabled or no email attr) """
    auto_login_idp_name: Optional[str] = None
    fullstory_org: Optional[str] = None
    """ FullStory organization ID for web analytics tracking """
    scarf_sh_pixel_id: Optional[str] = None
    """ Scarf.sh pixel ID for open-source analytics and usage """
    management_url: Optional[str] = None
    """ URL for a phoenix management interface, only visible to management users """
    support_email: Optional[str] = None
    """ Support email address for user assistance """
    has_db_threshold: bool = False
    """ Whether the database has a threshold for usage """
    allow_external_resources: bool = True
    """ Whether to allow external resources like Google Fonts in the web interface """
    agent_assistant_disabled: bool = False
    """ Whether the agent assistant feature is disabled at the deployment level"""
    agent_bash_disabled: bool = False
    """ Whether the server-side bash tool (subagents) is disabled at the deployment level"""
    dev_vite_port: int = 5173
    """ Port the Vite dev server runs on. Only used in development mode. """


class Static(StaticFiles):
    "Static file serving with a fallback to index.html"

    _app_config: AppConfig

    def __init__(self, *, app_config: AppConfig, **kwargs: Any):
        self._app_config = app_config
        super().__init__(**kwargs)

    @cached_property
    def _web_manifest(self) -> dict[str, Any]:
        try:
            with open(self._app_config.web_manifest_path, "r") as f:
                return cast(dict[str, Any], json.load(f))
        except FileNotFoundError as e:
            if self._app_config.is_development:
                return {}
            raise e

    async def get_response(self, path: str, scope: Scope) -> Response:
        # Redirect to the oauth2 login page if basic auth is disabled and auto_login is enabled
        # TODO: this needs to be refactored to be cleaner
        if (
            path == "login"
            and self._app_config.basic_auth_disabled
            and self._app_config.auto_login_idp_name
        ):
            redirect_path = prepend_root_path(
                scope, f"oauth2/{self._app_config.auto_login_idp_name}/login"
            )
            url = URL(redirect_path).include_query_params(**Request(scope).query_params)
            return RedirectResponse(url=url)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as e:
            if e.status_code != 404:
                raise e
            # Fallback to the index.html
            request = Request(scope)
            response = templates.TemplateResponse(
                request=request,
                name="index.html",
                context={
                    "basename": get_root_path(scope),
                    "platform_version": phoenix_version,
                    "is_development": self._app_config.is_development,
                    "vite_port": self._app_config.dev_vite_port,
                    "manifest": self._web_manifest,
                    "authentication_enabled": self._app_config.authentication_enabled,
                    "oauth2_idps": self._app_config.oauth2_idps,
                    "basic_auth_disabled": self._app_config.basic_auth_disabled,
                    "ldap_enabled": self._app_config.ldap_enabled,
                    "ldap_manual_user_creation_enabled": self._app_config.ldap_manual_user_creation_enabled,  # noqa: E501
                    "auto_login_idp_name": self._app_config.auto_login_idp_name,
                    "fullstory_org": self._app_config.fullstory_org,
                    "scarf_sh_pixel_id": self._app_config.scarf_sh_pixel_id,
                    "management_url": self._app_config.management_url,
                    "support_email": self._app_config.support_email,
                    "has_db_threshold": self._app_config.has_db_threshold,
                    "allow_external_resources": self._app_config.allow_external_resources,
                    "agent_assistant_disabled": self._app_config.agent_assistant_disabled,
                    "agent_bash_disabled": self._app_config.agent_bash_disabled,
                    "auth_error_messages": self._app_config.auth_error_messages,
                },
            )
        except Exception as e:
            raise e
        return response


class RequestOriginHostnameValidator(BaseHTTPMiddleware):
    def __init__(self, *args: Any, trusted_hostnames: list[str], **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._trusted_hostnames = trusted_hostnames

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        headers = request.headers
        for key in "origin", "referer":
            if not (url := headers.get(key)):
                continue
            if urlparse(url).hostname not in self._trusted_hostnames:
                return Response(f"untrusted {key}", status_code=401)
        return await call_next(request)


class HeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        from phoenix.version import __version__ as phoenix_version

        response = await call_next(request)
        response.headers["x-colab-notebook-cache-control"] = "no-cache"
        response.headers[PHOENIX_SERVER_VERSION_HEADER] = phoenix_version
        return response


class RedactorMiddleware(BaseHTTPMiddleware):
    """Binds the per-app Redactor to the `current_redactor` ContextVar."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        token = current_redactor.set(request.app.state.redactor)
        try:
            return await call_next(request)
        finally:
            current_redactor.reset(token)


def user_fastapi_middlewares() -> list[Middleware]:
    paths = get_env_fastapi_middleware_paths()
    middlewares = []
    for file_path, object_name in paths:
        middleware_class = import_object_from_file(file_path, object_name)
        if not issubclass(middleware_class, BaseHTTPMiddleware):
            raise TypeError(f"{middleware_class} is not a subclass of BaseHTTPMiddleware")
        middlewares.append(Middleware(middleware_class))
    return middlewares


def user_gql_extensions() -> list[type[SchemaExtension]]:
    paths = get_env_gql_extension_paths()
    extensions = []
    for file_path, object_name in paths:
        extension_class = import_object_from_file(file_path, object_name)
        if not issubclass(extension_class, SchemaExtension):
            raise TypeError(f"{extension_class} is not a subclass of SchemaExtension")
        extensions.append(extension_class)
    return extensions


def user_grpc_interceptors() -> list[ServerInterceptor]:
    paths = get_env_grpc_interceptor_paths()
    interceptors: list[ServerInterceptor] = []
    for file_path, object_name in paths:
        interceptor_class = import_object_from_file(file_path, object_name)
        if not issubclass(interceptor_class, ServerInterceptor):
            raise TypeError(f"{interceptor_class} is not a subclass of ServerInterceptor")
        interceptors.append(interceptor_class)
    return interceptors


ProjectRowId: TypeAlias = int


@router.get("/arize_phoenix_version")
async def version() -> PlainTextResponse:
    return PlainTextResponse(f"{phoenix_version}")


def _db(
    engine: AsyncEngine,
) -> Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory(lock: Optional[asyncio.Lock] = None) -> AsyncIterator[AsyncSession]:
        async with contextlib.AsyncExitStack() as stack:
            if lock:
                await stack.enter_async_context(lock)
            yield await stack.enter_async_context(Session.begin())

    return factory


@dataclass(frozen=True)
class ScaffolderConfig:
    db: DbSessionFactory
    tracing_fixture_names: Iterable[str] = field(default_factory=list)
    force_fixture_ingestion: bool = False
    scaffold_datasets: bool = False
    phoenix_url: str = f"http://{get_env_host()}:{get_env_port()}"


class Scaffolder(DaemonTask):
    def __init__(
        self,
        config: ScaffolderConfig,
        enqueue_span: Callable[[Span, ProjectName], Awaitable[None]],
        enqueue_annotations: Callable[..., Awaitable[None]],
    ) -> None:
        super().__init__()
        self._db = config.db
        self._enqueue_span = enqueue_span
        self._enqueue_annotations = enqueue_annotations
        self._tracing_fixtures = [
            get_trace_fixture_by_name(name) for name in set(config.tracing_fixture_names)
        ]
        self._force_fixture_ingestion = config.force_fixture_ingestion
        self._scaffold_datasets = config.scaffold_datasets
        self._phoenix_url = config.phoenix_url

    async def __aenter__(self) -> None:
        if not self._tracing_fixtures:
            return
        await self.start()

    async def _run(self) -> None:
        """
        Main entry point for Scaffolder.
        Determines whether to load fixtures and handles them.
        """
        if await self._should_load_fixtures():
            logger.info("Loading trace fixtures...")
            await self._handle_tracing_fixtures()
            logger.info("Finished loading fixtures.")
        else:
            logger.info("DB is not new, avoid loading demo fixtures.")

    async def _should_load_fixtures(self) -> bool:
        if self._force_fixture_ingestion:
            return True

        async with self._db() as session:
            created_at = await session.scalar(
                select(models.Project.created_at).where(models.Project.name == "default")
            )
        if created_at is None:
            return False

        is_new_db = datetime.now(timezone.utc) - created_at < timedelta(
            minutes=NEW_DB_AGE_THRESHOLD_MINUTES
        )
        return is_new_db

    async def _handle_tracing_fixtures(self) -> None:
        """
        Main handler for processing trace fixtures. Process each fixture by
        loading its trace dataframe, gettting and processings its
        spans and evals, and queuing.
        """
        loop = asyncio.get_running_loop()
        for fixture in self._tracing_fixtures:
            try:
                trace_ds = await loop.run_in_executor(None, load_example_traces, fixture.name)

                fixture_spans, trace_id_mapping, span_id_mapping = await loop.run_in_executor(
                    None,
                    reset_fixture_span_ids_and_timestamps,
                    [
                        # Apply `encode` here because legacy jsonl files contains UUIDs as strings.
                        # `encode` removes the hyphens in the UUIDs.
                        decode_otlp_span(encode_span_to_otlp(span))
                        for span in trace_ds.to_spans()
                    ],
                )

                # Ingest dataset fixtures
                if self._scaffold_datasets:
                    await self._handle_dataset_fixtures(fixture)

                project_name = fixture.project_name or fixture.name
                logger.info(f"Loading '{project_name}' fixtures...")
                for span in fixture_spans:
                    await self._enqueue_span(span, project_name)

                for eval_name, precursors_batch in get_annotation_precursors_from_fixture(
                    fixture.name
                ):
                    remapped = [
                        remap_precursor_ids(
                            p,
                            trace_id_mapping=trace_id_mapping,
                            span_id_mapping=span_id_mapping,
                        )
                        for p in precursors_batch
                    ]
                    for precursor in remapped:
                        await self._enqueue_annotations(precursor)
                    logger.info(
                        "Enqueued %s eval annotations for '%s'",
                        len(remapped),
                        eval_name,
                    )

            except FileNotFoundError:
                logger.warning(f"Fixture file not found for '{fixture.name}'")
            except ValueError as e:
                logger.error(f"Error processing fixture '{fixture.name}': {e}")
            except Exception as e:
                logger.error(f"Unexpected error processing fixture '{fixture.name}': {e}")

    async def _handle_dataset_fixtures(self, fixture: TracesFixture) -> None:
        loop = asyncio.get_running_loop()
        try:
            dataset_fixtures = await loop.run_in_executor(None, get_dataset_fixtures, fixture.name)
            await loop.run_in_executor(
                None,
                send_dataset_fixtures,
                self._phoenix_url,
                dataset_fixtures,
            )
        except Exception as e:
            logger.error(f"Error processing dataset fixture: {e}")


class _CapacityIndicator(Protocol):
    @property
    def is_full(self) -> bool: ...


class CapacityInterceptor(AsyncServerInterceptor):
    def __init__(self, indicator: _CapacityIndicator) -> None:
        self._indicator = indicator

    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        if self._indicator.is_full:
            SPAN_QUEUE_REJECTIONS.inc()
            context.set_code(grpc.StatusCode.RESOURCE_EXHAUSTED)
            context.set_details("Server is at capacity and cannot process more requests")
            return

        return await method(request_or_iterator, context)


def _lifespan(
    *,
    db: DbSessionFactory,
    bulk_inserter: BulkInserter,
    dml_event_handler: DmlEventHandler,
    trace_data_sweeper: Optional[TraceDataSweeper],
    experiment_sweeper: ExperimentSweeper,
    span_cost_calculator: SpanCostCalculator,
    generative_model_store: GenerativeModelStore,
    system_settings: SystemSettings,
    db_disk_usage_monitor: DbDiskUsageMonitor,
    experiment_runner: ExperimentRunner,
    sandbox_session_manager: SandboxSessionManager,
    online_eval_producer: Optional[OnlineEvalProducer] = None,
    online_eval_consumer: Optional[OnlineEvalConsumer] = None,
    online_eval_session_sweeper: Optional[SessionEvalSweeper] = None,
    token_store: Optional[TokenStore] = None,
    tracer_provider: Optional["TracerProvider"] = None,
    enable_prometheus: bool = False,
    startup_callbacks: Iterable[_Callback] = (),
    shutdown_callbacks: Iterable[_Callback] = (),
    read_only: bool = False,
    grpc_port: Optional[int] = None,
    initial_annotation_precursors: Iterable[AnnotationPrecursor] = (),
    scaffolder_config: Optional[ScaffolderConfig] = None,
    grpc_interceptors: Iterable[ServerInterceptor] = (),
    welcome_message: str | None = None,
    docs_mcp_server: Optional[MCPToolset[Any]] = None,
) -> StatefulLifespan[FastAPI]:
    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[dict[str, Any]]:
        resolved_grpc_port = get_env_grpc_port() if grpc_port is None else grpc_port
        for callback in startup_callbacks:
            if isinstance((res := callback()), Awaitable):
                await res
        db.lock = asyncio.Lock() if db.dialect is SupportedSQLDialect.SQLITE else None
        await system_settings.bootstrap()
        async with AsyncExitStack() as stack:
            (
                enqueue_annotations,
                enqueue_span,
                enqueue_operation,
            ) = await stack.enter_async_context(bulk_inserter)
            interceptors = [
                CapacityInterceptor(bulk_inserter),
                *user_grpc_interceptors(),
                *grpc_interceptors,
            ]
            grpc_server = GrpcServer(
                enqueue_span,
                port=resolved_grpc_port,
                disabled=read_only,
                tracer_provider=tracer_provider,
                enable_prometheus=enable_prometheus,
                token_store=token_store,
                interceptors=interceptors,
            )
            await stack.enter_async_context(grpc_server)
            await stack.enter_async_context(dml_event_handler)
            for precursor in initial_annotation_precursors:
                await enqueue_annotations(precursor)
            if trace_data_sweeper:
                await stack.enter_async_context(trace_data_sweeper)
            await stack.enter_async_context(experiment_sweeper)
            await stack.enter_async_context(span_cost_calculator)
            await stack.enter_async_context(generative_model_store)
            await stack.enter_async_context(system_settings)
            await stack.enter_async_context(db_disk_usage_monitor)
            # ``sandbox_session_manager`` must enter before ``experiment_runner``
            # so ``AsyncExitStack`` tears them down in reverse and the runner
            # (which consumes the manager) stops first. If the runner outlived
            # its manager, any ``acquire`` it issued after the manager's
            # shutdown snapshot would leak a provider session past the daemon.
            await stack.enter_async_context(sandbox_session_manager)
            await stack.enter_async_context(experiment_runner)
            # Enter the consumer before the producer so teardown stops admission
            # before draining work; both stop before sandbox_session_manager.
            if online_eval_consumer is not None:
                await stack.enter_async_context(online_eval_consumer)
            if online_eval_producer is not None:
                await stack.enter_async_context(online_eval_producer)
            if online_eval_session_sweeper is not None:
                await stack.enter_async_context(online_eval_session_sweeper)
            if docs_mcp_server is not None:
                # The docs MCP server connects to an external host during
                # startup. Never let its initialization (which can hang until a
                # deadline when egress is blocked) abort server startup; degrade
                # to the assistant running without docs tools instead.
                try:
                    await stack.enter_async_context(docs_mcp_server)
                except Exception:
                    logger.warning(
                        "Failed to initialize docs MCP server; continuing without docs capability.",
                        exc_info=True,
                    )
            if scaffolder_config:
                scaffolder = Scaffolder(
                    config=scaffolder_config,
                    enqueue_span=enqueue_span,
                    enqueue_annotations=enqueue_annotations,
                )
                await stack.enter_async_context(scaffolder)
            if isinstance(token_store, AbstractAsyncContextManager):
                await stack.enter_async_context(token_store)
            _warn_if_missing_aioboto3()
            if welcome_message:
                print(welcome_message, flush=True)
            yield {
                "event_queue": dml_event_handler,
                "enqueue_annotations": enqueue_annotations,
                "enqueue_span": enqueue_span,
                "enqueue_operation": enqueue_operation,
                "experiment_runner": experiment_runner,
            }
        for callback in shutdown_callbacks:
            if isinstance((res := callback()), Awaitable):
                await res

    return lifespan


@router.get("/healthz")
async def check_healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


@router.get("/readyz")
async def check_readyz(request: Request) -> JSONResponse:
    try:
        async with request.app.state.db() as session:
            await session.execute(select(1))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(status_code=503, detail="database unreachable")
    return JSONResponse({})


def create_graphql_router(
    *,
    graphql_schema: strawberry.Schema,
    db: DbSessionFactory,
    system_settings: SystemSettings,
    last_updated_at: CanGetLastUpdatedAt,
    authentication_enabled: bool,
    span_cost_calculator: SpanCostCalculator,
    experiment_runner: ExperimentRunner,
    sandbox_session_manager: SandboxSessionManager,
    encrypt: Callable[[bytes], bytes],
    decrypt: Callable[[bytes], bytes],
    cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
    event_queue: CanPutItem[DmlEvent],
    read_only: bool = False,
    secret: Optional[SecretStr] = None,
    token_store: Optional[TokenStore] = None,
    email_sender: Optional[EmailSender] = None,
) -> GraphQLRouter[Context, None]:
    """Creates the GraphQL router.

    Args:
        schema (BaseSchema): The GraphQL schema.
        db (DbSessionFactory): The database session factory pointing to a SQL database.
        last_updated_at (CanGetLastUpdatedAt): How to get the last updated timestamp for updates.
        authentication_enabled (bool): Whether authentication is enabled.
        span_cost_calculator (SpanCostCalculator): The span cost calculator for calculating costs.
        event_queue (CanPutItem[DmlEvent]): The event queue for DML events.
        cache_for_dataloaders (Optional[CacheForDataLoaders], optional): GraphQL data loaders.
        read_only (bool, optional): Marks the app as read-only. Defaults to False.
        secret (Optional[Secret], optional): The application secret for auth. Defaults to None.
        token_store (Optional[TokenStore], optional): The token store for auth. Defaults to None.
        email_sender (Optional[EmailSender], optional): The email sender. Defaults to None.

    Returns:
        GraphQLRouter: The router mounted at /graphql
    """

    allowed_provider_names = get_env_allowed_providers()

    def get_context() -> Context:
        return build_context(
            db=db,
            settings=system_settings,
            span_cost_calculator=span_cost_calculator,
            experiment_runner=experiment_runner,
            sandbox_session_manager=sandbox_session_manager,
            encrypt=encrypt,
            decrypt=decrypt,
            cache_for_dataloaders=cache_for_dataloaders,
            last_updated_at=last_updated_at,
            event_queue=event_queue,
            allowed_provider_names=allowed_provider_names,
            read_only=read_only,
            auth_enabled=authentication_enabled,
            secret=secret,
            token_store=token_store,
            email_sender=email_sender,
        )

    router = GraphQLRouter(
        graphql_schema,
        graphql_ide="graphiql",
        context_getter=get_context,
        include_in_schema=False,
        prefix="/graphql",
        dependencies=(Depends(is_authenticated),) if authentication_enabled else (),
        subscription_protocols=[],
    )
    return router


def instrument_engine_if_enabled(engine: AsyncEngine) -> list[Callable[[], None]]:
    instrumentation_cleanups = []
    if server_instrumentation_is_enabled():
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        tracer_provider = initialize_opentelemetry_tracer_provider()
        SQLAlchemyInstrumentor().instrument(
            engine=engine.sync_engine,
            tracer_provider=tracer_provider,
        )
        instrumentation_cleanups.append(SQLAlchemyInstrumentor().uninstrument)
    return instrumentation_cleanups


async def plain_text_http_exception_handler(request: Request, exc: HTTPException) -> Response:
    """
    Overrides the default handler for HTTPExceptions to return a plain text
    response instead of a JSON response. For the original source code, see
    https://github.com/tiangolo/fastapi/blob/d3cdd3bbd14109f3b268df7ca496e24bb64593aa/fastapi/exception_handlers.py#L11
    """
    headers = getattr(exc, "headers", None)
    if not is_body_allowed_for_status_code(exc.status_code):
        return Response(status_code=exc.status_code, headers=headers)
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code, headers=headers)


class _HasDbStatus(Protocol):
    @property
    def should_not_insert_or_update(self) -> bool: ...


class DbDiskUsageInterceptor(AsyncServerInterceptor):
    def __init__(self, db: _HasDbStatus) -> None:
        self._db = db

    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        if (
            method_name.endswith("trace.v1.TraceService/Export")
            and self._db.should_not_insert_or_update
        ):
            details = (
                "Database operations are disabled due to insufficient storage. "
                "Please delete old data or increase storage."
            )
            if support_email := get_env_support_email():
                details += f" Need help? Contact us at {support_email}"
            await context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED, details)
        return await method(request_or_iterator, context)


def create_app(
    db: DbSessionFactory,
    authentication_enabled: bool,
    debug: bool = False,
    dev: bool = False,
    dev_vite_port: int = 5173,
    read_only: bool = False,
    grpc_port: Optional[int] = None,
    enable_prometheus: bool = False,
    initial_spans: Optional[Iterable[Union[Span, tuple[Span, str]]]] = None,
    initial_annotation_precursors: Optional[Iterable[AnnotationPrecursor]] = None,
    serve_ui: bool = True,
    startup_callbacks: Iterable[_Callback] = (),
    shutdown_callbacks: Iterable[_Callback] = (),
    secret: Optional[SecretStr] = None,
    password_reset_token_expiry: Optional[timedelta] = None,
    access_token_expiry: Optional[timedelta] = None,
    refresh_token_expiry: Optional[timedelta] = None,
    scaffolder_config: Optional[ScaffolderConfig] = None,
    email_sender: Optional[EmailSender] = None,
    oauth2_client_configs: Optional[list[OAuth2ClientConfig]] = None,
    ldap_config: Optional["LDAPConfig"] = None,
    basic_auth_disabled: bool = False,
    bulk_inserter_factory: Optional[Callable[..., BulkInserter]] = None,
    allowed_origins: Optional[list[str]] = None,
    management_url: Optional[str] = None,
    welcome_message: str | None = None,
) -> FastAPI:
    verify_server_environment_variables()
    bulk_inserter_factory = bulk_inserter_factory or BulkInserter
    startup_callbacks_list: list[_Callback] = list(startup_callbacks)
    shutdown_callbacks_list: list[_Callback] = list(shutdown_callbacks)
    startup_callbacks_list.append(Facilitator(db=db))
    startup_callbacks_list.append(prefetch_wasm_binary_if_needed)
    initial_batch_of_spans: Iterable[tuple[Span, str]] = (
        ()
        if initial_spans is None
        else (
            ((item, DEFAULT_PROJECT_NAME) if isinstance(item, Span) else item)
            for item in initial_spans
        )
    )
    startup_annotation_precursors = (
        () if initial_annotation_precursors is None else initial_annotation_precursors
    )
    cache_for_dataloaders = (
        CacheForDataLoaders() if db.dialect is SupportedSQLDialect.SQLITE else None
    )
    last_updated_at = LastUpdatedAt()
    middlewares: list[Middleware] = [
        Middleware(HeadersMiddleware),
        Middleware(RedactorMiddleware),
    ]
    middlewares.extend(user_fastapi_middlewares())
    if origins := get_env_csrf_trusted_origins():
        trusted_hostnames = [h for o in origins if o and (h := urlparse(o).hostname)]
        middlewares.append(
            Middleware(
                RequestOriginHostnameValidator,
                trusted_hostnames=trusted_hostnames,
            )
        )
    elif email_sender or oauth2_client_configs:
        logger.warning(
            "CSRF protection can be enabled by listing trusted origins via "
            f"the `{ENV_PHOENIX_CSRF_TRUSTED_ORIGINS}` environment variable. "
            "This is recommended when setting up OAuth2 clients or sending "
            "password reset emails."
        )
    if authentication_enabled and secret:
        token_store = JwtStore(db, secret)
        middlewares.append(
            Middleware(
                AuthenticationMiddleware,
                backend=BearerTokenAuthBackend(token_store),
            )
        )
    else:
        token_store = None
    dml_event_handler = DmlEventHandler(
        db=db,
        cache_for_dataloaders=cache_for_dataloaders,
        last_updated_at=last_updated_at,
    )
    trace_data_sweeper = TraceDataSweeper(
        db=db,
        dml_event_handler=dml_event_handler,
    )
    experiment_sweeper = ExperimentSweeper(db)
    generative_model_store = GenerativeModelStore(db)
    system_settings = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    span_cost_calculator = SpanCostCalculator(db, generative_model_store)
    bulk_inserter = bulk_inserter_factory(
        db,
        span_cost_calculator=span_cost_calculator,
        event_queue=dml_event_handler,
        initial_batch_of_spans=initial_batch_of_spans,
        max_spans_queue_size=get_env_max_spans_queue_size(),
    )
    tracer_provider = None
    graphql_schema_extensions: list[Union[type[SchemaExtension], Callable[[], SchemaExtension]]] = [
        lambda: QueryDepthLimiter(max_depth=20),
        lambda: MaxAliasesLimiter(max_alias_count=50),
    ]
    graphql_schema_extensions.extend(user_gql_extensions())

    if server_instrumentation_is_enabled():
        tracer_provider = initialize_opentelemetry_tracer_provider()
        from opentelemetry.trace import TracerProvider
        from strawberry.extensions.tracing import OpenTelemetryExtension

        if TYPE_CHECKING:
            # Type-check the class before monkey-patching its private attribute.
            assert OpenTelemetryExtension._tracer

        class _OpenTelemetryExtension(OpenTelemetryExtension):
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                super().__init__(*args, **kwargs)
                # Monkey-patch its private tracer to eliminate usage of the global
                # TracerProvider, which in a notebook setting could be the one
                # used by OpenInference.
                self._tracer = cast(TracerProvider, tracer_provider).get_tracer("strawberry")

        graphql_schema_extensions.append(_OpenTelemetryExtension)
    encryption_service = EncryptionService(secret=secret)
    redactor = Redactor(secret=secret or SecretStr(""))
    sandbox_session_manager = SandboxSessionManager()
    experiment_runner = ExperimentRunner(
        db,
        decrypt=encryption_service.decrypt,
        tracer_factory=lambda: Tracer(span_cost_calculator=span_cost_calculator),
        sandbox_session_manager=sandbox_session_manager,
    )
    online_eval_producer: Optional[OnlineEvalProducer] = None
    online_eval_consumer: Optional[OnlineEvalConsumer] = None
    online_eval_session_sweeper: Optional[SessionEvalSweeper] = None
    if get_env_online_eval_enabled() and not read_only:
        online_eval_producer = OnlineEvalProducer(db)
        online_eval_consumer = OnlineEvalConsumer(
            db,
            decrypt=encryption_service.decrypt,
            sandbox_session_manager=sandbox_session_manager,
            event_queue=dml_event_handler,
        )
        online_eval_session_sweeper = SessionEvalSweeper(db)
    graphql_schema = build_graphql_schema(graphql_schema_extensions)
    graphql_router = create_graphql_router(
        db=db,
        system_settings=system_settings,
        graphql_schema=graphql_schema,
        authentication_enabled=authentication_enabled,
        last_updated_at=last_updated_at,
        event_queue=dml_event_handler,
        cache_for_dataloaders=cache_for_dataloaders,
        read_only=read_only,
        secret=secret,
        token_store=token_store,
        email_sender=email_sender,
        span_cost_calculator=span_cost_calculator,
        experiment_runner=experiment_runner,
        sandbox_session_manager=sandbox_session_manager,
        encrypt=encryption_service.encrypt,
        decrypt=encryption_service.decrypt,
    )
    if enable_prometheus:
        from phoenix.server.prometheus import PrometheusMiddleware

        middlewares.append(Middleware(PrometheusMiddleware))
    grpc_interceptors: list[ServerInterceptor] = []
    grpc_interceptors.append(DbDiskUsageInterceptor(db))
    docs_mcp_server = (
        MintlifyDocsMCPServer()
        if not get_env_disable_agent_assistant() and get_env_allow_external_resources()
        else None
    )
    app = FastAPI(
        title="Arize-Phoenix REST API",
        version=REST_API_VERSION,
        lifespan=_lifespan(
            db=db,
            read_only=read_only,
            grpc_port=grpc_port,
            initial_annotation_precursors=startup_annotation_precursors,
            bulk_inserter=bulk_inserter,
            dml_event_handler=dml_event_handler,
            trace_data_sweeper=trace_data_sweeper,
            experiment_sweeper=experiment_sweeper,
            span_cost_calculator=span_cost_calculator,
            generative_model_store=generative_model_store,
            system_settings=system_settings,
            db_disk_usage_monitor=DbDiskUsageMonitor(db, email_sender),
            experiment_runner=experiment_runner,
            sandbox_session_manager=sandbox_session_manager,
            online_eval_producer=online_eval_producer,
            online_eval_consumer=online_eval_consumer,
            online_eval_session_sweeper=online_eval_session_sweeper,
            grpc_interceptors=grpc_interceptors,
            token_store=token_store,
            tracer_provider=tracer_provider,
            enable_prometheus=enable_prometheus,
            shutdown_callbacks=shutdown_callbacks_list,
            startup_callbacks=startup_callbacks_list,
            scaffolder_config=scaffolder_config,
            welcome_message=welcome_message,
            docs_mcp_server=docs_mcp_server,
        ),
        middleware=middlewares,
        exception_handlers={
            HTTPException: plain_text_http_exception_handler,
        },
        debug=debug,
        swagger_ui_parameters={
            "defaultModelsExpandDepth": -1,  # hides the schema section in the Swagger UI
        },
    )
    app.include_router(create_v1_router(authentication_enabled))
    if not get_env_disable_agent_assistant():
        app.include_router(create_agents_router(authentication_enabled))
    app.include_router(router)
    app.include_router(graphql_router)
    if authentication_enabled:
        # Only register LDAP endpoint if LDAP is configured
        app.include_router(create_auth_router(ldap_enabled=ldap_config is not None))
        app.include_router(oauth2_router)

    def _openapi() -> dict[str, Any]:
        """Generate the OpenAPI schema served to Swagger UI.

        In production, only routes under ``/v1`` are included. In dev mode,
        agent routes (``/agents``) are also exposed so they appear in Swagger UI.
        """
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=app.description,
            routes=app.routes,
            separate_input_output_schemas=False,
        )
        prefixes = ("/v1", "/agents") if dev else ("/v1",)
        schema["paths"] = {
            path: ops for path, ops in schema["paths"].items() if path.startswith(prefixes)
        }
        app.openapi_schema = schema
        return schema

    app.openapi = _openapi  # type: ignore[method-assign]
    app.add_middleware(GZipMiddleware)
    static_dir = SERVER_DIR / "static"
    web_manifest_path = static_dir / ".vite" / "manifest.json"
    has_built_ui = web_manifest_path.is_file()
    if dev:
        static_dir.mkdir(parents=True, exist_ok=True)
    if serve_ui and not dev and not has_built_ui:
        logger.warning(
            "Phoenix UI is not mounted because built frontend assets are missing at %s. "
            "The package may be missing bundled UI files.",
            web_manifest_path,
        )
    if serve_ui and (dev or has_built_ui):
        oauth2_idps = [
            OAuth2Idp(name=config.idp_name, displayName=config.idp_display_name)
            for config in oauth2_client_configs or []
        ]
        auto_login_idp_name = next(
            (config.idp_name for config in (oauth2_client_configs or []) if config.auto_login), None
        )
        app.mount(
            "/",
            app=Static(
                directory=static_dir,
                app_config=AppConfig(
                    is_development=dev,
                    authentication_enabled=authentication_enabled,
                    web_manifest_path=web_manifest_path,
                    oauth2_idps=oauth2_idps,
                    basic_auth_disabled=basic_auth_disabled,
                    ldap_enabled=ldap_config is not None,
                    # Disable manual user creation when LDAP disabled or no email attr
                    ldap_manual_user_creation_enabled=(
                        ldap_config.attr_email is not None if ldap_config else False
                    ),
                    auto_login_idp_name=auto_login_idp_name,
                    fullstory_org=Settings.fullstory_org,
                    scarf_sh_pixel_id=Settings.scarf_sh_pixel_id,
                    management_url=management_url,
                    support_email=get_env_support_email(),
                    has_db_threshold=bool(
                        get_env_database_allocated_storage_capacity_gibibytes()
                        and get_env_database_usage_insertion_blocking_threshold_percentage()
                    ),
                    allow_external_resources=get_env_allow_external_resources(),
                    agent_assistant_disabled=get_env_disable_agent_assistant(),
                    agent_bash_disabled=get_env_phoenix_agents_disable_bash(),
                    auth_error_messages=dict(AUTH_ERROR_MESSAGES) if authentication_enabled else {},
                    dev_vite_port=dev_vite_port,
                ),
            ),
            name="static",
        )
    app.state.authentication_enabled = authentication_enabled
    app.state.read_only = read_only
    app.state.password_reset_token_expiry = password_reset_token_expiry
    app.state.access_token_expiry = access_token_expiry
    app.state.refresh_token_expiry = refresh_token_expiry
    app.state.oauth2_clients = OAuth2Clients.from_configs(oauth2_client_configs or [])
    # Cache LDAPAuthenticator to avoid re-parsing TLS config on every login
    if ldap_config:
        from phoenix.server.ldap import LDAPAuthenticator

        app.state.ldap_authenticator = LDAPAuthenticator(ldap_config)
    app.state.db = db
    app.state.system_settings = system_settings
    app.state.email_sender = email_sender
    app.state.span_cost_calculator = span_cost_calculator
    app.state.encrypt = encryption_service.encrypt
    app.state.decrypt = encryption_service.decrypt
    app.state.redactor = redactor
    app.state.span_queue_is_full = lambda: bulk_inserter.is_full
    app.state.docs_mcp_server = docs_mcp_server
    app.state.sandbox_session_manager = sandbox_session_manager
    app.state.online_eval_producer = online_eval_producer
    app.state.online_eval_consumer = online_eval_consumer
    app.state.online_eval_session_sweeper = online_eval_session_sweeper
    app.state.graphql_schema = graphql_schema
    app.state.build_graphql_context = _get_build_graphql_context_function(
        db=db,
        system_settings=system_settings,
        span_cost_calculator=span_cost_calculator,
        experiment_runner=experiment_runner,
        sandbox_session_manager=sandbox_session_manager,
        encrypt=encryption_service.encrypt,
        decrypt=encryption_service.decrypt,
        cache_for_dataloaders=cache_for_dataloaders,
        last_updated_at=last_updated_at,
        event_queue=dml_event_handler,
        allowed_provider_names=get_env_allowed_providers(),
        read_only=read_only,
        authentication_enabled=authentication_enabled,
        secret=secret,
        token_store=token_store,
        email_sender=email_sender,
    )
    app = _add_get_secret_method(app=app, secret=secret)
    app = _add_get_token_store_method(app=app, token_store=token_store)
    if tracer_provider:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor().instrument(tracer_provider=tracer_provider)
        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        shutdown_callbacks_list.append(FastAPIInstrumentor().uninstrument)
    if allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    return app


def _add_get_secret_method(*, app: FastAPI, secret: Optional[SecretStr]) -> FastAPI:
    """
    Dynamically adds a `get_secret` method to the app's `state`.
    """
    app.state._secret = secret

    def get_secret(self: StarletteState) -> SecretStr:
        if (secret := self._secret) is None:
            raise ValueError("app secret is not set")
        assert isinstance(secret, SecretStr)
        return secret

    app.state.get_secret = MethodType(get_secret, app.state)
    return app


def _add_get_token_store_method(*, app: FastAPI, token_store: Optional[JwtStore]) -> FastAPI:
    """
    Dynamically adds a `get_token_store` method to the app's `state`.
    """
    app.state._token_store = token_store

    def get_token_store(self: StarletteState) -> JwtStore:
        if (token_store := self._token_store) is None:
            raise ValueError("token store is not set on the app")
        assert isinstance(token_store, JwtStore)
        return token_store

    app.state.get_token_store = MethodType(get_token_store, app.state)
    return app


def _get_build_graphql_context_function(
    *,
    db: DbSessionFactory,
    system_settings: SystemSettings,
    span_cost_calculator: SpanCostCalculator,
    experiment_runner: ExperimentRunner,
    sandbox_session_manager: SandboxSessionManager,
    encrypt: Callable[[bytes], bytes],
    decrypt: Callable[[bytes], bytes],
    cache_for_dataloaders: Optional[CacheForDataLoaders],
    last_updated_at: CanGetLastUpdatedAt,
    event_queue: CanPutItem[DmlEvent],
    allowed_provider_names: Optional[frozenset[str]],
    read_only: bool,
    authentication_enabled: bool,
    secret: Optional[SecretStr],
    token_store: Optional[TokenStore],
    email_sender: Optional[EmailSender],
) -> Callable[[Optional[PhoenixUser]], Context]:
    """Factory for creating GraphQL context."""

    def build_graphql_context(user: Optional[PhoenixUser] = None) -> Context:
        request = Request(
            {
                "type": "http",
                "user": user if user is not None else UnauthenticatedUser(),
            }
        )
        return build_context(
            db=db,
            settings=system_settings,
            span_cost_calculator=span_cost_calculator,
            experiment_runner=experiment_runner,
            sandbox_session_manager=sandbox_session_manager,
            encrypt=encrypt,
            decrypt=decrypt,
            cache_for_dataloaders=cache_for_dataloaders,
            last_updated_at=last_updated_at,
            event_queue=event_queue,
            allowed_provider_names=allowed_provider_names,
            read_only=read_only,
            auth_enabled=authentication_enabled,
            secret=secret,
            token_store=token_store,
            email_sender=email_sender,
            request=request,
        )

    return build_graphql_context


def _warn_if_missing_aioboto3() -> None:
    """
    Check if boto3 is installed without aioboto3 and log a warning.

    This helps users who have boto3 installed but haven't migrated to
    aioboto3 for Phoenix's AWS Bedrock integration in Playground.
    """

    try:
        import aioboto3  # type: ignore[import-untyped] # noqa: F401

        return
    except ImportError:
        try:
            import boto3  # type: ignore[import-untyped] # noqa: F401

            logger.warning(
                "boto3 is installed but aioboto3 is not. To use AWS Bedrock models "
                "in Playground, install aioboto3: pip install aioboto3"
            )
        except ImportError:
            pass
