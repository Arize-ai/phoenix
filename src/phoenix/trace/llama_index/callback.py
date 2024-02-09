import logging
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

from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.tracer import _show_deprecation_warnings

logger = logging.getLogger(__name__)


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
        tracer_provider = trace_sdk.TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().__init__(trace_api.get_tracer(__name__, __version__, tracer_provider))
