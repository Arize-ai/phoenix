import sys
from typing import Any

import phoenix.trace.langchain.instrumentor as _instrumentor
import phoenix.trace.langchain.tracer as _tracer


class _Deprecation:
    def __getattr__(self, name: str) -> Any:
        if name == "tracer":
            return _tracer
        if name == "instrumentor":
            return _instrumentor
        if name == "OpenInferenceTracer":
            return _tracer.OpenInferenceTracer  # type: ignore
        if name == "LangChainInstrumentor":
            return _instrumentor.LangChainInstrumentor
        raise AttributeError(f"module {__name__} has no attribute {name}")

    __all__ = list(
        set(vars().keys()).union({"OpenInferenceTracer", "LangChainInstrumentor"})
        - {"__module__", "__qualname__"}
    )


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _Deprecation()  # type: ignore
