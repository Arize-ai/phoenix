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

from .session.client import Client
from .session.evaluation import log_evaluations
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
    "log_evaluations",
    "Client",
    "evals",
]


class PhoenixTraceFinder(MetaPathFinder):
    def find_spec(self, fullname: Any, path: Any, target: Any = None) -> Optional[ModuleSpec]:
        if fullname == "phoenix.trace.openai":
            return ModuleSpec(fullname, PhoenixTraceOpenAILoader())
        if fullname == "phoenix.trace.langchain":
            return ModuleSpec(fullname, PhoenixTraceLangchainLoader())
        if fullname == "phoenix.trace.llama_index":
            return ModuleSpec(fullname, PhoenixTraceLlamaIndexLoader())
        return None


class PhoenixTraceOpenAILoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
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
        )


class PhoenixTraceLangchainLoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    "Please use OpenInference to instrument the Langchain SDK. Additionally, the `phoenix.otel` "
    "module can be used to quickly configure OpenTelemetry:\n\n"

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
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
        )


class PhoenixTraceLlamaIndexLoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
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
        )


sys.meta_path.append(PhoenixTraceFinder())
