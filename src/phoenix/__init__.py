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
    "Inferences",
    "EmbeddingColumnNames",
    "RetrievalEmbeddingColumnNames",
    "Schema",
    "load_example",
    "ExampleInferences",
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
