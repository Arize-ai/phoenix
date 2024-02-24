import sys
from importlib.abc import Loader, MetaPathFinder
from importlib.machinery import ModuleSpec
from types import ModuleType
from typing import Any, Optional

from .datasets.dataset import Dataset
from .datasets.fixtures import ExampleDatasets, load_example
from .datasets.schema import EmbeddingColumnNames, RetrievalEmbeddingColumnNames, Schema
from .session.client import Client
from .session.evaluation import log_evaluations
from .session.session import NotebookEnvironment, Session, active_session, close_app, launch_app
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
    "Dataset",
    "EmbeddingColumnNames",
    "RetrievalEmbeddingColumnNames",
    "Schema",
    "load_example",
    "ExampleDatasets",
    "active_session",
    "close_app",
    "launch_app",
    "Session",
    "load_example_traces",
    "TraceDataset",
    "NotebookEnvironment",
    "log_evaluations",
    "Client",
    "evals",
]


class PhoenixEvalsFinder(MetaPathFinder):
    def find_spec(self, fullname: Any, path: Any, target: Any = None) -> Optional[ModuleSpec]:
        if fullname == "phoenix.evals":
            return ModuleSpec(fullname, PhoenixEvalsLoader())
        return None


class PhoenixEvalsLoader(Loader):
    def create_module(self, spec: ModuleSpec) -> None:
        return None

    def exec_module(self, module: ModuleType) -> None:
        raise ImportError(
            "The optional `phoenix.evals` package is not installed. "
            "Please install `phoenix` with the `evals` extra: `pip install 'arize-phoenix[evals]'`."
        )


sys.meta_path.append(PhoenixEvalsFinder())
