from typing import Any, Optional

from phoenix.trace.instrumentor import Instrumentor

from .tracer import OpenInferenceTracer

MINIMUM_LANGCHAIN_VERSION = "0.13.0"


class LangChainInstrumentor(Instrumentor):
    """
    Instruments the OpenInferenceTracer for LangChain automatically by patching the
    BaseCallbackManager in LangChain.
    """

    def __init__(self, tracer: Optional[OpenInferenceTracer] = None) -> None:
        self._tracer = tracer if tracer is not None else OpenInferenceTracer()

    def instrument(self) -> None:
        try:
            from langchain.callbacks.base import BaseCallbackManager

            source_init = BaseCallbackManager.__init__

            tracer = self._tracer

            # Patch the init method of the BaseCallbackManager to add the tracer
            # to all callback managers
            def patched_init(self: BaseCallbackManager, *args: Any, **kwargs: Any) -> None:
                source_init(self, *args, **kwargs)
                self.add_handler(tracer, True)

            BaseCallbackManager.__init__ = patched_init  # type: ignore
        except ImportError:
            self._raise_import_error(
                package_display_name="LangChain",
                package_name="langchain",
            )

    from langchain.callbacks.base import BaseCallbackManager

    old_init = BaseCallbackManager.__init__
