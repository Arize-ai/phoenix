import logging
import re
from importlib.metadata import PackageNotFoundError
from importlib.util import find_spec
from typing import (
    Any,
)

from openinference.instrumentation.llama_index._callback import (
    OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler,
)
from openinference.instrumentation.llama_index.version import (
    __version__,
)
from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.errors import IncompatibleLibraryVersionError
from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.tracer import _show_deprecation_warnings

logger = logging.getLogger(__name__)

LLAMA_INDEX_MODERN_VERSION = (0, 10, 0)
INSTRUMENTATION_MODERN_VERSION = (1, 0, 0)


def _parse_version(version: str) -> tuple[int, int, int]:
    # Use a regular expression to match the major, minor, and patch components
    # The expression captures digits in three groups and ignores any suffixes like "-post1"
    match = re.match(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise ValueError(f"Invalid version format: {version}")

    # Extract the major, minor, and patch numbers and convert them to integers
    major, minor, patch = map(int, match.groups())

    return (major, minor, patch)


def _check_instrumentation_compatibility() -> None:
    import llama_index as llama_index
    import openinference.instrumentation.llama_index as instrumentation

    # split the version string into a tuple of integers
    llama_index_version_str = llama_index.__version__
    instrumentation_version_str = instrumentation.__version__  # type: ignore
    llama_index_version = _parse_version(llama_index_version_str)
    instrumentation_version = _parse_version(instrumentation_version_str)
    # check if the llama_index version is compatible with the instrumentation version
    if (
        llama_index_version < LLAMA_INDEX_MODERN_VERSION
        and instrumentation_version >= INSTRUMENTATION_MODERN_VERSION
    ):
        raise IncompatibleLibraryVersionError(
            f"""llama-index v{llama_index_version_str} is not compatible with
             openinference-instrumentation-llama-index
             v{instrumentation_version_str}. Please either migrate llama-index to
             at least 0.10.0 or downgrade openinference-instrumentation-llama-index via
             `pip install openinference-instrumentation-llama-index<1.0.0`."""
        )


class OpenInferenceTraceCallbackHandler(_OpenInferenceTraceCallbackHandler):
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/openinference
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _show_deprecation_warnings(self, *args, **kwargs)
        llama_index_spec = find_spec("llama_index")
        if llama_index_spec is None:
            raise PackageNotFoundError(
                "Missing `llama-index`. Install with `pip install llama-index`."
            )
        _check_instrumentation_compatibility()
        tracer_provider = trace_sdk.TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().__init__(trace_api.get_tracer(__name__, __version__, tracer_provider))
