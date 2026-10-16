"""
LLM Wrapper module - DEPRECATED

This module has been moved to phoenix.evals.llm.llm.
All imports from this module will continue to work but will issue deprecation warnings.

Please update your imports to use phoenix.evals.llm.llm (or phoenix.evals.llm) instead.
"""

import warnings

from .llm import (
    LLM,
    generate_classification_schema,
    show_provider_availability,
)

warnings.warn(
    "The phoenix.evals.llm.wrapper module is deprecated and will be removed in a future version. "
    "Please use phoenix.evals.llm.llm instead.",
    DeprecationWarning,
    stacklevel=2,
)

__all__ = [
    "LLM",
    "generate_classification_schema",
    "show_provider_availability",
]
