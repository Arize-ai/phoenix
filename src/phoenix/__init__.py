# The following line is needed to ensure that other modules using the
# `phoenix.*` path can be discovered by Bazel. For details,
# see: https://github.com/Arize-ai/openinference/issues/398
# IMPORTANT: This must come before any imports that depend on namespace packages
__path__ = __import__("pkgutil").extend_path(__path__, __name__)

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
