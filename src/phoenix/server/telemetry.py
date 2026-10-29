import logging
import os
from functools import partial
from typing import Any, Callable

from graphql import GraphQLResolveInfo
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.resource import ResourceAttributes
from strawberry.extensions import SchemaExtension
from strawberry.extensions.tracing import OpenTelemetryExtension

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)
from phoenix.version import __version__

logger = logging.getLogger(__name__)

_SERVICE_NAME = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH = "/v1/traces"
_OTLP_HTTP_LOGS_PATH = "/v1/logs"


def normalize_http_trace_collector_endpoint(endpoint: str) -> str:
    return _normalize_http_collector_endpoint(endpoint, _OTLP_HTTP_TRACES_PATH)


def normalize_http_log_collector_endpoint(endpoint: str) -> str:
    return _normalize_http_collector_endpoint(endpoint, _OTLP_HTTP_LOGS_PATH)


def _normalize_http_collector_endpoint(endpoint: str, signal_path: str) -> str:
    """Return the full OTLP/HTTP URL for one signal, tolerating a missing scheme or a
    pre-appended signal path."""
    normalized_endpoint = endpoint
    if not normalized_endpoint.startswith("http://") and not normalized_endpoint.startswith(
        "https://"
    ):
        logger.warning(
            "HTTP collector endpoint should include the protocol (http:// or https://)."
            "Assuming http."
        )
        normalized_endpoint = f"http://{endpoint}"
    if normalized_endpoint.endswith(signal_path):
        logger.warning(
            f"HTTP collector endpoint should not include the {signal_path} path. Removing it."
        )
        normalized_endpoint = normalized_endpoint[: -len(signal_path)]
    return normalized_endpoint.rstrip("/") + signal_path


def _server_resource() -> Resource:
    return Resource(
        attributes={
            ResourceAttributes.SERVICE_NAME: _SERVICE_NAME,
            ResourceAttributes.SERVICE_VERSION: __version__,
        }
    )


# Resolvers whose arguments carry credentials, personal data or customer content.
# Every other resolver's arguments are recorded on its span as Strawberry does by
# default, so filters, ids and names stay available for debugging.
_REDACTED_RESOLVERS: frozenset[tuple[str, str]] = frozenset(
    {
        # Passwords, email addresses and usernames.
        ("Mutation", "createUser"),
        ("Mutation", "patchUser"),
        ("Mutation", "patchViewer"),
        # Provider API keys, secrets and sandbox environment variables.
        ("Mutation", "createGenerativeModelCustomProvider"),
        ("Mutation", "patchGenerativeModelCustomProvider"),
        ("Mutation", "testGenerativeModelCustomProviderCredentials"),
        ("Mutation", "upsertOrDeleteSecrets"),
        ("Mutation", "createSandboxConfig"),
        ("Mutation", "updateSandboxConfig"),
        ("Mutation", "updateSandboxProvider"),
        ("Mutation", "resumeExperiment"),
        ("Mutation", "evaluatorPreviews"),
        ("Subscription", "chatCompletion"),
        ("Subscription", "chatCompletionOverDataset"),
        # Prompt templates, dataset examples, annotation text and conversations.
        ("Mutation", "createChatPrompt"),
        ("Mutation", "createChatPromptVersion"),
        ("Mutation", "createDatasetLlmEvaluator"),
        ("Mutation", "updateDatasetLlmEvaluator"),
        ("Mutation", "addExamplesToDataset"),
        ("Mutation", "patchDatasetExamples"),
        ("Mutation", "createDatasetSplitWithExamples"),
        ("Mutation", "createSpanAnnotations"),
        ("Mutation", "createSpanNotes"),
        ("Mutation", "patchSpanAnnotations"),
        ("Mutation", "createTraceAnnotations"),
        ("Mutation", "createTraceNotes"),
        ("Mutation", "patchTraceAnnotations"),
        ("Mutation", "createDocumentAnnotations"),
        ("Mutation", "patchDocumentAnnotations"),
        ("Mutation", "createProjectSessionAnnotations"),
        ("Mutation", "createProjectSessionNotes"),
        ("Mutation", "updateProjectSessionAnnotations"),
        ("Mutation", "createAgentSession"),
        ("Mutation", "branchAgentSession"),
        ("Mutation", "patchAgentSession"),
    }
)

_REDACTED = "[redacted]"


def redact_sensitive_arguments(
    args: dict[str, Any], info: GraphQLResolveInfo[Any]
) -> dict[str, Any]:
    """Strawberry ``arg_filter``: keep the argument names of a sensitive resolver but
    not their values."""
    if (info.parent_type.name, info.field_name) in _REDACTED_RESOLVERS:
        return dict.fromkeys(args, _REDACTED)
    return args


def graphql_tracing_extension(tracer_provider: TracerProvider) -> Callable[[], SchemaExtension]:
    """An extension factory bound to this provider rather than the global one, which in
    a notebook could be the provider OpenInference is using."""
    return partial(
        OpenTelemetryExtension,
        tracer_provider=tracer_provider,
        arg_filter=redact_sensitive_arguments,
    )


def initialize_opentelemetry_tracer_provider() -> TracerProvider:
    logger.info("Initializing OpenTelemetry tracer provider")
    tracer_provider = TracerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(
            BatchSpanProcessor(HttpExporter(normalize_http_trace_collector_endpoint(http_endpoint)))
        )
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT
    ):
        logger.info(f"Using gRPC collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GrpcExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(GrpcExporter(grpc_endpoint)))
    logger.info("🔭 OpenTelemetry tracer provider initialized")
    return tracer_provider


def initialize_opentelemetry_logger_provider() -> LoggerProvider:
    """Build a logger provider exporting over OTLP and attach it to the root logger."""
    logger.info("Initializing OpenTelemetry logger provider")
    logger_provider = LoggerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP log collector endpoint: {http_endpoint}")
        from opentelemetry.exporter.otlp.proto.http._log_exporter import (
            OTLPLogExporter as HttpExporter,
        )

        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(
                HttpExporter(normalize_http_log_collector_endpoint(http_endpoint))
            )
        )
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT
    ):
        logger.info(f"Using gRPC log collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc._log_exporter import (
            OTLPLogExporter as GrpcExporter,
        )

        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(GrpcExporter(grpc_endpoint))
        )
    logging.getLogger().addHandler(LoggingHandler(logger_provider=logger_provider))
    logger.info("🔭 OpenTelemetry logger provider initialized")
    return logger_provider
