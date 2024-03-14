import logging
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Optional, Tuple

from openinference.semconv.resource import ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.config import get_env_project_name
from phoenix.trace.errors import IncompatibleLibraryVersionError
from phoenix.trace.exporter import _OpenInferenceExporter

logger = logging.getLogger(__name__)

LLAMA_INDEX_MODERN_VERSION = (0, 10, 0)
INSTRUMENTATION_MODERN_VERSION = (1, 0, 0)


def _check_instrumentation_compatibility() -> bool:
    llama_index_version_str = _get_version_if_installed("llama-index")
    llama_index_installed = llama_index_version_str is not None
    llama_index_core_version_str = _get_version_if_installed("llama-index-core")
    llama_index_core_installed = modern_llama_index_installed = (
        llama_index_core_version_str is not None
    )
    instrumentation_version_str = version("openinference-instrumentation-llama-index")
    instrumentation_version = _parse_semantic_version(instrumentation_version_str)

    if not llama_index_installed and not llama_index_core_installed:
        raise PackageNotFoundError(
            "Missing `llama_index`. "
            "Install with `pip install llama-index` or "
            "`pip install llama-index-core` for a minimal installation."
        )
    elif modern_llama_index_installed and instrumentation_version < INSTRUMENTATION_MODERN_VERSION:
        raise IncompatibleLibraryVersionError(
            f"llama-index-core v{llama_index_core_version_str} is not compatible with "
            f"openinference-instrumentation-llama-index v{instrumentation_version_str}. "
            "Please upgrade openinference-instrumentation-llama-index to at least 1.0.0 via "
            "`pip install 'openinference-instrumentation-llama-index>=1.0.0'`."
        )
    elif (
        llama_index_installed
        and llama_index_version_str
        and _parse_semantic_version(llama_index_version_str) < LLAMA_INDEX_MODERN_VERSION
        and instrumentation_version >= INSTRUMENTATION_MODERN_VERSION
    ):
        raise IncompatibleLibraryVersionError(
            f"llama-index v{llama_index_version_str} is not compatible with "
            f"openinference-instrumentation-llama-index v{instrumentation_version_str}. "
            "Please either migrate llama-index to at least 0.10.0 or downgrade "
            "openinference-instrumentation-llama-index via "
            "`pip install 'openinference-instrumentation-llama-index<1.0.0'`."
        )
    return True


def _get_version_if_installed(package_name: str) -> Optional[str]:
    """
    Gets the version of the package if it is installed, otherwise, returns None.
    """
    try:
        return version(package_name)
    except PackageNotFoundError:
        return None


def _parse_semantic_version(semver_string: str) -> Tuple[int, ...]:
    """
    Parse a semantic version string into a tuple of integers.
    """
    return tuple(map(int, semver_string.split(".")[:3]))


if _check_instrumentation_compatibility():
    from openinference.instrumentation.llama_index._callback import (
        OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler,
    )
    from openinference.instrumentation.llama_index.version import (
        __version__,
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
        tracer_provider = trace_sdk.TracerProvider(
            resource=Resource({ResourceAttributes.PROJECT_NAME: get_env_project_name()}),
            span_limits=trace_sdk.SpanLimits(max_attributes=10_000),
        )
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().__init__(trace_api.get_tracer(__name__, __version__, tracer_provider))
