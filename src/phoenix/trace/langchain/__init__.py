import sys
from typing import Any

import phoenix.trace.langchain.instrumentor as _instrumentor
import phoenix.trace.langchain.tracer as _tracer

_DUMMY = "OpenInferenceTracer"


class _Deprecation:
    __all__ = ("LangChainInstrumentor", _DUMMY)

    def __getattr__(self, name: str) -> Any:
        if name == "tracer":
            return _tracer
        if name == "instrumentor":
            return _instrumentor
        if name == _DUMMY:
            return getattr(_tracer, name)
        if name == "LangChainInstrumentor":
            return _instrumentor.LangChainInstrumentor
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _Deprecation()  # type: ignore
