from .datasets.dataset import Dataset
from .datasets.fixtures import ExampleDatasets, load_example
from .datasets.schema import EmbeddingColumnNames, Schema
from .session.session import Session, active_session, close_app, launch_app

__version__ = "0.0.23rc1"

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
    "Dataset",
    "EmbeddingColumnNames",
    "Schema",
    "load_example",
    "ExampleDatasets",
    "active_session",
    "close_app",
    "launch_app",
    "Session",
]
