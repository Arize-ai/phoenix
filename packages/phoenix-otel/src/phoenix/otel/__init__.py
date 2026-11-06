from openinference.instrumentation import (
    suppress_tracing,
    using_attributes,
    using_metadata,
    using_prompt_template,
    using_session,
    using_tags,
    using_user,
)
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.sdk.resources import Resource

from .otel import (
    PROJECT_NAME,
    BatchSpanProcessor,
    GRPCSpanExporter,
    HTTPSpanExporter,
    SimpleSpanProcessor,
    TracerProvider,
    register,
)

try:
    from importlib.metadata import version

    __version__ = version("arize-phoenix-otel")
except Exception:
    __version__ = "unknown"

__all__ = [
    "TracerProvider",
    "SimpleSpanProcessor",
    "BatchSpanProcessor",
    "HTTPSpanExporter",
    "GRPCSpanExporter",
    "Resource",
    "PROJECT_NAME",
    "register",
    "__version__",
    "suppress_tracing",
    "using_attributes",
    "using_metadata",
    "using_prompt_template",
    "using_session",
    "using_tags",
    "using_user",
    "SpanAttributes",
    "OpenInferenceSpanKindValues",
    "OpenInferenceMimeTypeValues",
]
