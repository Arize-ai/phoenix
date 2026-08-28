# The following line is needed to ensure that other modules using the
# `phoenix.*` path can be discovered by Bazel. For details,
# see: https://github.com/Arize-ai/openinference/issues/398
# IMPORTANT: This must come before any imports that depend on namespace packages
__path__ = __import__("pkgutil").extend_path(__path__, __name__)

import sys
from importlib.abc import Loader, MetaPathFinder
from importlib.machinery import ModuleSpec
from types import ModuleType
from typing import Any, Optional

from .session.session import (
    NotebookEnvironment,
    Session,
    active_session,
    close_app,
    delete_all,
    launch_app,
)
from .trace.fixtures import load_example_traces
from .trace.trace_dataset import TraceDataset
from .version import __version__

# module level doc-string
__doc__ = """
arize-phoenix - AI Observability Platform
=====================================================================
**phoenix** is a Python package that provides AI observability and
tracing built on OpenTelemetry.
"""

__all__ = [
    "__version__",
    "active_session",
    "close_app",
    "launch_app",
    "delete_all",
    "Session",
    "load_example_traces",
    "TraceDataset",
    "NotebookEnvironment",
    "evals",
]


_INSTALL_PHOENIX_CLIENT = (
    "Please use the `arize-phoenix-client` package instead:\n\npip install arize-phoenix-client\n"
)

_REMOVED_MODULES: dict[str, str] = {
    "phoenix.session.client": (
        "The legacy `phoenix.session.client.Client` class has been removed.\n"
        f"{_INSTALL_PHOENIX_CLIENT}\n"
        "```python\n"
        "from phoenix.client import Client\n"
        "```\n"
    ),
    "phoenix.trace.openai": (
        "The legacy `phoenix.trace.openai` instrumentor module has been removed.\n"
        "Please use OpenInference to instrument the OpenAI SDK. Additionally, the "
        "`phoenix.otel` module can be used to quickly configure OpenTelemetry:\n\n"
        "https://arize.com/docs/phoenix/tracing/integrations-tracing/openai"
        "\n\n"
        "Example usage:\n\n"
        "pip install openinference-instrumentation-openai\n\n"
        "```python\n"
        "from phoenix.otel import register\n"
        "from openinference.instrumentation.openai import OpenAIInstrumentor\n\n"
        "tracer_provider = register()\n"
        "OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)\n"
        "```\n"
    ),
    "phoenix.trace.langchain": (
        "The legacy `phoenix.trace.langchain` instrumentor module has been removed.\n"
        "Please use OpenInference to instrument the LangChain SDK. Additionally, the "
        "`phoenix.otel` module can be used to quickly configure OpenTelemetry:\n\n"
        "https://arize.com/docs/phoenix/tracing/integrations-tracing/langchain"
        "\n\n"
        "Example usage:\n\n"
        "```python\n"
        "from phoenix.otel import register\n"
        "from openinference.instrumentation.langchain import LangChainInstrumentor\n\n"
        "tracer_provider = register()\n"
        "LangChainInstrumentor().instrument(tracer_provider=tracer_provider)\n"
        "```\n"
    ),
    "phoenix.trace.llama_index": (
        "The legacy `phoenix.trace.llama_index` instrumentor module has been removed.\n"
        "Please use OpenInference to instrument the LlamaIndex SDK. Additionally, the "
        "`phoenix.otel` module can be used to quickly configure OpenTelemetry:\n\n"
        "https://arize.com/docs/phoenix/tracing/integrations-tracing/llamaindex"
        "\n\n"
        "Example usage:\n\n"
        "```python\n"
        "from phoenix.otel import register\n"
        "from openinference.instrumentation.llama_index import LlamaIndexInstrumentor\n\n"
        "tracer_provider = register()\n"
        "LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)\n"
        "```\n"
    ),
}
"""Modules removed from Phoenix, mapped to the guidance shown when they are imported."""

_REMOVED_ATTRIBUTES: dict[str, str] = {
    "Client": (
        "The legacy `px.Client` class has been removed.\n"
        f"{_INSTALL_PHOENIX_CLIENT}\n"
        "```python\n"
        "from phoenix.client import Client\n\n"
        'client = Client(base_url="http://localhost:6006")\n'
        "```\n"
    ),
    "log_evaluations": (
        "The legacy `px.log_evaluations` function has been removed, "
        "and evaluations are now annotations.\n"
        f"{_INSTALL_PHOENIX_CLIENT}\n"
        "```python\n"
        "from phoenix.client import Client\n\n"
        "Client().spans.log_span_annotations_dataframe(\n"
        "    dataframe=dataframe,\n"
        '    annotation_name="Hallucination",\n'
        '    annotator_kind="LLM",\n'
        ")\n"
        "```\n"
    ),
}
"""Top-level `phoenix` attributes removed, mapped to the guidance shown on access."""


class _RemovedModuleLoader(Loader):
    """Loader that raises `ImportError` with migration guidance for a removed module."""

    def __init__(self, message: str) -> None:
        self._message = message

    def create_module(self, spec: ModuleSpec) -> None:
        # Defer to default module-creation semantics, as the previous loaders did.
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(self._message)


class _RemovedModuleFinder(MetaPathFinder):
    """Meta path finder that intercepts imports of modules removed from Phoenix.

    It is appended to `sys.meta_path` so that it only runs after the standard import
    machinery has failed to locate the module, turning an opaque `ModuleNotFoundError`
    into an `ImportError` that points at the replacement API.
    """

    def find_spec(self, fullname: Any, path: Any, target: Any = None) -> Optional[ModuleSpec]:
        if (message := _REMOVED_MODULES.get(fullname)) is None:
            return None
        return ModuleSpec(fullname, _RemovedModuleLoader(message))


def __getattr__(name: str) -> Any:
    """Raise `AttributeError` with migration guidance for removed top-level attributes."""
    if (message := _REMOVED_ATTRIBUTES.get(name)) is not None:
        raise AttributeError(message)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


sys.meta_path.append(_RemovedModuleFinder())
