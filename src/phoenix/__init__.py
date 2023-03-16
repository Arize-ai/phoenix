from .datasets import Dataset, EmbeddingColumnNames, Schema, load_example
from .session.session import active_session, close_app, launch_app

# module level doc-string
__doc__ = """
arize-phoenix - ML Observability in a notebook
=====================================================================
**phoenix** is a Python package providing Phoenix provides MLOps insights at
lightning speed with zero-config observability for model drift, performance, and
data quality. 

Main Features 
------------- 
Here are just a few of the things that phoenix does well:
  - Compare two sets of model inferences against one another
  - Identify problematic embeddings cohorts using UMAP and clustering
  - Explore model performance, drift, and data quality metrics
"""
