"""Secret-free, JSON-friendly views of Harbor agent configuration."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any, cast

__all__ = ["MODEL_PARAM_KEYS", "is_secret_key", "model_params", "redact_secrets"]

MODEL_PARAM_KEYS = (
    "temperature",
    "top_p",
    "top_k",
    "max_tokens",
    "max_output_tokens",
    "max_completion_tokens",
    "max_thinking_tokens",
    "reasoning_effort",
    "seed",
    "frequency_penalty",
    "presence_penalty",
    "stop",
)
"""Agent kwargs that are lifted into ``harbor_agent.model_params``."""

# Terminus-style agents forward these nested mappings to the model client.
_NESTED_MODEL_KWARGS = ("llm_kwargs", "llm_call_kwargs")

# A key is dropped when any of its word segments is one of these. Matching
# whole segments keeps count fields such as ``max_tokens`` while dropping
# ``access_token``, ``api_key``, ``extra_headers``, and ``extra_env``.
_SECRET_SEGMENTS = frozenset(
    {
        "apikey",
        "auth",
        "authorization",
        "bearer",
        "cookie",
        "cookies",
        "credential",
        "credentials",
        "env",
        "header",
        "headers",
        "key",
        "passwd",
        "password",
        "secret",
        "secrets",
        "token",
    }
)
# The second branch splits an acronym from the word after it: ``OpenAIKey``.
_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
_SEGMENT_SEPARATOR = re.compile(r"[^a-z0-9]+")
_URL_USERINFO = re.compile(r"(?<=://)[^/@\s]+@")
_QUERY_PARAM = re.compile(r"(?<=[?&])([^=&#\s]+)=[^&#\s]*")
_REDACTED = "REDACTED"


def is_secret_key(key: str) -> bool:
    """Checks whether a configuration key names a credential or secret holder."""
    words = _CAMEL_BOUNDARY.sub("_", key).lower()
    return any(segment in _SECRET_SEGMENTS for segment in _SEGMENT_SEPARATOR.split(words))


def redact_secrets(value: Any) -> Any:
    """Returns a JSON-friendly copy of ``value`` without secret-named keys.

    Mapping keys become strings. Strings lose any user information embedded in
    URLs, and secret-named query parameters keep their names but not their
    values. Values that aren't JSON scalars, mappings, or sequences become
    strings.
    """
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _QUERY_PARAM.sub(_redact_query_param, _URL_USERINFO.sub("", value))
    if isinstance(value, Mapping):
        mapping: Mapping[Any, Any] = value
        return {
            str(key): redact_secrets(item)
            for key, item in mapping.items()
            if not is_secret_key(str(key))
        }
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        sequence: Sequence[Any] = value
        return [redact_secrets(item) for item in sequence]
    return redact_secrets(str(value))


def _redact_query_param(match: re.Match[str]) -> str:
    name = match.group(1)
    return f"{name}={_REDACTED}" if is_secret_key(name) else match.group(0)


def model_params(kwargs: Mapping[str, Any]) -> dict[str, Any]:
    """Returns the model parameters set in agent kwargs, keyed by parameter name.

    Top-level kwargs win over the same parameter in ``llm_kwargs``, which wins
    over ``llm_call_kwargs``. Unset parameters are omitted.
    """
    sources: list[Mapping[str, Any]] = [kwargs]
    sources.extend(
        cast(Mapping[str, Any], nested)
        for name in _NESTED_MODEL_KWARGS
        if isinstance(nested := kwargs.get(name), Mapping)
    )
    params: dict[str, Any] = {}
    for key in MODEL_PARAM_KEYS:
        for source in sources:
            if source.get(key) is not None:
                params[key] = redact_secrets(source[key])
                break
    return params
