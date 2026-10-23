"""Backwards-compatible shim.

The contents of this module moved to ``phoenix.evals.llm.llm``. This module is
kept so that ``phoenix.evals.llm.wrapper`` keeps working as a public import
path. Import from ``phoenix.evals.llm`` or ``phoenix.evals`` instead.
"""

from .llm import LLM, generate_classification_schema, show_provider_availability

__all__ = [
    "LLM",
    "generate_classification_schema",
    "show_provider_availability",
]
