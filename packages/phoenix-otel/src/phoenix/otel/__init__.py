<<<<<<< HEAD
from opentelemetry.sdk.resources import Resource  # type: ignore[attr-defined]
=======
from opentelemetry.sdk.resources import Resource  # type: ignore
>>>>>>> d212a7d75651b5ea213c1fcd24d39244abbc490e

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
