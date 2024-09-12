import sys
from importlib.abc import Loader, MetaPathFinder
from importlib.machinery import ModuleSpec
from types import ModuleType
from typing import Any, Optional

from .inferences.fixtures import ExampleInferences, load_example
from .inferences.inferences import Inferences
from .inferences.schema import EmbeddingColumnNames, RetrievalEmbeddingColumnNames, Schema
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
arize-phoenix - ML Observability in a notebook
=====================================================================
**phoenix** is a Python package that provides MLOps insights at
lightning speed with zero-config observability for model drift, performance, and
data quality.

Main Features
-------------
Here are just a few of the things that phoenix does well:
  - Compare two sets of model inferences against one another
  - Identify problematic embeddings cohorts using UMAP and clustering
  - Explore model performance, drift, and data quality metrics
"""

__all__ = [
    "__version__",
    "active_session",
    "Inferences",
    "EmbeddingColumnNames",
    "RetrievalEmbeddingColumnNames",
    "Schema",
    "load_example",
    "ExampleInferences",
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
            "Please use the `phoenix.otel` package to directly configure OpenTelemetry and "
            "instrument the OpenAI SDK with OpenInference:\n\n"
            "https://docs.arize.com/phoenix/tracing/integrations-tracing/openai"
            "\n\n"
            "Example usage:\n\n"
            "```python\n"
            "from phoenix.otel register\n"
            "from openinference.instrumentation.openai import OpenAIInstrumentor\n\n"
            "tracer_provider = register()\n"
            "OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)\n"
            "```\n"
        )


class PhoenixTraceLangchainLoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
            "The legacy `phoenix.trace.langchain` instrumentor module has been removed.\n"
            "Please use the `phoenix.otel` package to directly configure OpenTelemetry and "
            "instrument the Langchain SDK with OpenInference:\n\n"
            "https://docs.arize.com/phoenix/tracing/integrations-tracing/langchain"
            "\n\n"
            "Example usage:\n\n"
            "```python\n"
            "from phoenix.otel import register\n"
            "from openinference.instrumentation.langchain import LangchainInstrumentor\n\n"
            "tracer_provider = register()\n"
            "LangchainInstrumentor().instrument(tracer_provider=tracer_provider)\n"
            "```\n"
        )


class PhoenixTraceLlamaIndexLoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
            "The legacy `phoenix.trace.llama_index` instrumentor module has been removed.\n"
            "Please use the `phoenix.otel` package to directly configure OpenTelemetry and "
            "instrument the LlamaIndex SDK with OpenInference:\n\n"
            "https://docs.arize.com/phoenix/tracing/integrations-tracing/llamaindex"
            "\n\n"
            "Example usage:\n\n"
            "```python\n"
            "from phoenix.otel import register\n"
            "from openinference.instrumentation.llamaindex import LlamaIndexInstrumentor\n\n"
            "tracer_provider = register()\n"
            "LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)\n"
            "```\n"
        )


sys.meta_path.append(PhoenixTraceFinder())
