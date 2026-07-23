"""Shared LLM judge configuration for PXI online LLM evaluators.

One provider/model pair configures every LLM evaluator in this package via
``PHOENIX_AGENTS_EVALS_PROVIDER`` / ``PHOENIX_AGENTS_EVALS_MODEL`` (defaults:
``openai`` / ``gpt-5.5``). The matching provider API key must be set; the
runner validates this at startup before discovering any traces.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from phoenix.evals.llm import LLM

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-5.5"
PROVIDER_ENV_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_GENERATIVE_AI_API_KEY",
}


def provider() -> str:
    value = os.getenv("PHOENIX_AGENTS_EVALS_PROVIDER") or DEFAULT_PROVIDER
    if value not in PROVIDER_ENV_KEYS:
        choices = ", ".join(sorted(PROVIDER_ENV_KEYS))
        raise ValueError(
            f"unsupported PHOENIX_AGENTS_EVALS_PROVIDER {value!r}; expected one of: {choices}"
        )
    return value


def model() -> str:
    return os.getenv("PHOENIX_AGENTS_EVALS_MODEL") or DEFAULT_MODEL


def validate_required_env() -> None:
    """Fail fast on a bad provider or missing API key, before any trace work."""
    key = PROVIDER_ENV_KEYS[provider()]
    if not os.getenv(key):
        raise RuntimeError(
            f"missing required environment variable {key} for LLM judge provider {provider()!r}"
        )


@lru_cache(maxsize=1)
def judge_llm() -> "LLM":
    from phoenix.evals.llm import LLM  # heavy import deferred

    return LLM(provider=provider(), model=model())
