from typing import Any, Optional

from .tracer import OpenInferenceTracer


class LangChainInstrumentor:
    """
    Instruments the OpenInferenceTracer for LangChain automatically by patching the
    BaseCallbackManager in LangChain.
    """

    def __init__(self, tracer: Optional[OpenInferenceTracer] = None) -> None:
        self._tracer = tracer if tracer is not None else OpenInferenceTracer()

    def instrument(self) -> None:
        try:
            from langchain.callbacks.base import BaseCallbackManager
        except ImportError:
            # Raise a cleaner error if LangChain is not installed
            raise ImportError(
                "LangChain is not installed. Please install LangChain first to use the instrumentor"
            )

        source_init = BaseCallbackManager.__init__

        # Keep track of the source init so we can tell if the patching occurred
        self._source_callback_manager_init = source_init

        tracer = self._tracer

        # Patch the init method of the BaseCallbackManager to add the tracer
        # to all callback managers
        def patched_init(self: BaseCallbackManager, *args: Any, **kwargs: Any) -> None:
            source_init(self, *args, **kwargs)
            self.add_handler(tracer, True)

        BaseCallbackManager.__init__ = patched_init  # type: ignore
