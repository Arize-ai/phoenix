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

# Import version from package metadata
try:
    from importlib.metadata import version

    __version__ = version("arize-phoenix-otel")
except ImportError:
    # Fallback for Python < 3.8
    from importlib_metadata import version

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
]
