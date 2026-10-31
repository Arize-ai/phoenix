"""Secret-free, JSON-friendly views of Harbor agent configuration."""

from __future__ import annotations

import dataclasses
import re
from collections.abc import Mapping, Sequence
from datetime import date, datetime, time
from enum import Enum
from pathlib import PurePath
from typing import Any, cast

__all__ = [
    "MODEL_PARAM_KEYS",
    "is_secret_key",
    "model_params",
    "redact_secrets",
    "redacted_key_paths",
]

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

# A key is dropped when any of its word segments contains one of these, which
# also catches plurals and unseparated compounds such as ``accesstoken``. This
# follows Harbor's own env-key redaction and deliberately over-matches: the
# names of dropped keys stay visible in ``redacted_kwargs``.
_SECRET_SUBSTRINGS = (
    "auth",
    "bearer",
    "cookie",
    "credential",
    "header",
    "jwt",
    "key",
    "passphrase",
    "passw",
    "secret",
    "signature",
    "token",
)
# Short words that would match too much as substrings.
_SECRET_SEGMENTS = frozenset({"dsn", "env", "environ", "environment", "pwd", "sig", "sigs"})
# A ``tokens`` segment next to one of these words counts tokens, as in
# ``max_tokens`` or ``thinking_budget_tokens``, rather than holding them.
_TOKEN_COUNT_SEGMENTS = frozenset({"budget", "count", "limit", "max", "min", "n", "num"})

# The second branch splits an acronym from the word after it: ``OpenAIKey``.
_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
_SEGMENT_SEPARATOR = re.compile(r"[^a-z0-9]+")
# Userinfo runs to the last ``@`` before the path, query, or fragment. A
# password may also contain ``/``, so after a ``user:`` prefix it runs to the
# last ``@`` before the query or fragment.
_URL_USERINFO = re.compile(r"(?<=://)(?:[^\s/?#:@]*:[^\s?#]*|[^\s/?#]*)@")
_QUERY_PARAM = re.compile(r"(?<=[?&])([^=&#\s]+)=[^&#\s]*")
_REDACTED = "REDACTED"


def is_secret_key(key: str) -> bool:
    """Checks whether a configuration key names a credential or secret holder."""
    words = _CAMEL_BOUNDARY.sub("_", key).lower()
    segments = [segment for segment in _SEGMENT_SEPARATOR.split(words) if segment]
    if _TOKEN_COUNT_SEGMENTS.intersection(segments):
        segments = [segment for segment in segments if segment != "tokens"]
    return any(
        segment in _SECRET_SEGMENTS or any(word in segment for word in _SECRET_SUBSTRINGS)
        for segment in segments
    )


def redact_secrets(value: Any) -> Any:
    """Returns a JSON-friendly copy of ``value`` without secret-named keys.

    Mapping keys become strings. Strings lose any user information embedded in
    URLs, and secret-named query parameters keep their names but not their
    values. Dataclasses and Pydantic models are redacted field by field. Other
    objects are recorded as their type name, because their string form can
    contain secrets.
    """
    return _redact(value, path="", dropped=[])


def redacted_key_paths(value: Any) -> list[str]:
    """Returns the dotted paths of the keys that ``redact_secrets`` drops."""
    dropped: list[str] = []
    _redact(value, path="", dropped=dropped)
    return dropped


def _redact(value: Any, *, path: str, dropped: list[str]) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _QUERY_PARAM.sub(_redact_query_param, _URL_USERINFO.sub("", value))
    if isinstance(value, Mapping):
        mapping: Mapping[Any, Any] = value
        redacted: dict[str, Any] = {}
        for key, item in mapping.items():
            item_path = f"{path}.{key}" if path else str(key)
            if is_secret_key(str(key)):
                dropped.append(item_path)
            else:
                redacted[str(key)] = _redact(item, path=item_path, dropped=dropped)
        return redacted
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        sequence: Sequence[Any] = value
        return [
            _redact(item, path=f"{path}.{index}" if path else str(index), dropped=dropped)
            for index, item in enumerate(sequence)
        ]
    return _redact(_to_plain(value), path=path, dropped=dropped)


def _to_plain(value: Any) -> Any:
    """Converts an object that isn't JSON-like into a value ``_redact`` handles."""
    if isinstance(value, (set, frozenset)):
        return sorted(cast(set[Any], value), key=str)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, PurePath):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump) and not isinstance(value, type):
        return model_dump()
    return type(value).__name__


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
