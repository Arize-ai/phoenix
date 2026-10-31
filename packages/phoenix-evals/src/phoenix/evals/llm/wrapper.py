"""Backward-compatibility shim.

The contents of this module moved to ``phoenix.evals.llm.llm``. This module
re-exports them so that existing imports from ``phoenix.evals.llm.wrapper``
keep working.
"""

from .llm import (
    LLM,
    generate_classification_schema,
    show_provider_availability,
)

__all__ = [
    "LLM",
    "generate_classification_schema",
    "show_provider_availability",
]
