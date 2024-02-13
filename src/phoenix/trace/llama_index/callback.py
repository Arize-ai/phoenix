import logging
from importlib.metadata import PackageNotFoundError, version
from importlib.util import find_spec
from typing import Any

from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.errors import IncompatibleLibraryVersionError
from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.tracer import _show_deprecation_warnings

logger = logging.getLogger(__name__)

LLAMA_INDEX_MODERN_VERSION = (0, 10, 0)
INSTRUMENTATION_MODERN_VERSION = (1, 0, 0)


def _check_instrumentation_compatibility() -> bool:
    # split the version string into a tuple of integers
    llama_index_version = tuple(map(int, version("llama-index").split(".")[:3]))
    instrumentation_version = tuple(
        map(int, version("openinference-instrumentation-llama-index").split(".")[:3])
    )
    # check if the llama_index version is compatible with the instrumentation version
    if (
        llama_index_version < LLAMA_INDEX_MODERN_VERSION
        and instrumentation_version >= INSTRUMENTATION_MODERN_VERSION
    ):
        raise IncompatibleLibraryVersionError(
            f"""llama-index v{'.'.join(map(str, llama_index_version))} is not compatible with
             openinference-instrumentation-llama-index
             v{instrumentation_version}. Please either migrate llama-index to
             at least 0.10.0 or downgrade openinference-instrumentation-llama-index via
             `pip install openinference-instrumentation-llama-index<1.0.0`."""
        )
    elif (
        llama_index_version >= LLAMA_INDEX_MODERN_VERSION
        and instrumentation_version < INSTRUMENTATION_MODERN_VERSION
    ):
        raise IncompatibleLibraryVersionError(
            f"""llama-index v{'.'.join(map(str, llama_index_version))} is not compatible with
             openinference-instrumentation-llama-index
             v{instrumentation_version}. Please upgrade
             openinference-instrumentation-llama-index to at least 1.0.0"""
        )
    # if the versions are compatible, return True
    return True


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
        _show_deprecation_warnings(self, *args, **kwargs)
        if find_spec("llama_index") is None:
            raise PackageNotFoundError(
                "Missing `llama-index`. Install with `pip install llama-index`."
            )
        _check_instrumentation_compatibility()
        tracer_provider = trace_sdk.TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().__init__(trace_api.get_tracer(__name__, __version__, tracer_provider))
