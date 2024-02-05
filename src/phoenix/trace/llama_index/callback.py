import logging
from typing import (
    TYPE_CHECKING,
    Any,
)

from openinference.instrumentation.llama_index import (
    OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler,
)
from openinference.instrumentation.llama_index.version import __version__
from opentelemetry import trace as trace_api
from wrapt import ObjectProxy

from phoenix.trace.exporter import HttpExporter
from phoenix.trace.tracer import OpenInferenceTracer

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class OpenInferenceTraceCallbackHandler(ObjectProxy):  # type: ignore
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/openinference
    """

    def __init__(
        self,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        exporter = kwargs.get("exporter")
        if isinstance(exporter, HttpExporter):
            logger.warning("OpenInferenceTraceCallbackHandler: Using HttpExporter is deprecated. ")
        self._tracer = OpenInferenceTracer(exporter=exporter)
        if not (tracer_provider := kwargs.get("tracer_provider")):
            tracer_provider = trace_api.get_tracer_provider()
        tracer = trace_api.get_tracer(__name__, __version__, tracer_provider)
        super().__init__(
            _OpenInferenceTraceCallbackHandler(
                tracer=tracer,
            )
        )
