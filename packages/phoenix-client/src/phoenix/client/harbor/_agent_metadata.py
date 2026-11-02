"""Secret-free, JSON-friendly views of Harbor agent configuration."""

from __future__ import annotations

import dataclasses
import math
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
_SECRET_SEGMENTS = frozenset(
    {
        "cred",
        "creds",
        "dsn",
        "env",
        "environ",
        "environment",
        "pass",
        "pw",
        "pwd",
        "sig",
        "sigs",
    }
)
# A ``tokens`` segment next to one of these words counts tokens, as in
# ``max_tokens`` or ``thinking_budget_tokens``, rather than holding them.
_TOKEN_COUNT_SEGMENTS = frozenset({"budget", "count", "limit", "max", "min", "n", "num"})

# The second branch splits an acronym from the word after it: ``OpenAIKey``.
_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
_SEGMENT_SEPARATOR = re.compile(r"[^a-z0-9]+")
_SCHEME_SEPARATOR = re.compile(r"://")
_AUTHORITY_END = re.compile(r"[\s/?#]")
_QUERY_START = re.compile(r"[\s?#]")
# Bounds the search for a password that contains ``/``, which keeps redaction
# linear on long strings.
_MAX_USERINFO_LENGTH = 256
# Parameters follow ``?``, ``&``, or ``;`` in a query, or ``#`` in an OAuth fragment.
_QUERY_PARAM = re.compile(r"(?<=[?&;#])([^=&;#\s]+)=[^&;#\s]*")
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
    if isinstance(value, float) and not math.isfinite(value):
        # Phoenix rejects NaN and infinity in JSON, which would fail the job.
        return str(value)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _redact_string(value)
    if isinstance(value, Mapping):
        mapping: Mapping[Any, Any] = value
        redacted: dict[str, Any] = {}
        for raw_key, item in mapping.items():
            # Keys such as endpoint URLs can carry credentials too.
            key = _redact_string(str(raw_key))
            item_path = f"{path}.{key}" if path else key
            if is_secret_key(str(raw_key)):
                dropped.append(item_path)
            else:
                redacted[key] = _redact(item, path=item_path, dropped=dropped)
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


def _redact_string(value: str) -> str:
    return _QUERY_PARAM.sub(_redact_query_param, _strip_url_userinfo(value))


def _strip_url_userinfo(text: str) -> str:
    parts: list[str] = []
    position = 0
    for separator in _SCHEME_SEPARATOR.finditer(text):
        start = separator.end()
        if start < position:
            continue
        userinfo_end = _userinfo_end(text, start)
        if userinfo_end is not None:
            parts.append(text[position:start])
            position = userinfo_end
    parts.append(text[position:])
    return "".join(parts)


def _userinfo_end(text: str, start: int) -> int | None:
    """Returns the index after the userinfo of the URL authority at ``start``.

    Userinfo runs to the last ``@`` in the authority. When the authority has no
    ``@`` but looks like ``user:password`` rather than ``host:port`` or an IPv6
    host, the password might contain ``/``, so userinfo runs to the next ``@``
    before the query or fragment.
    """
    authority_end = _AUTHORITY_END.search(text, start)
    stop = authority_end.start() if authority_end else len(text)
    at = text.rfind("@", start, stop)
    if at != -1:
        return at + 1
    authority = text[start:stop]
    _, colon, port = authority.partition(":")
    if not colon or port.isdigit() or authority.startswith("["):
        return None
    limit = min(len(text), stop + _MAX_USERINFO_LENGTH)
    query_start = _QUERY_START.search(text, stop, limit)
    if query_start:
        limit = query_start.start()
    at = text.find("@", stop, limit)
    return at + 1 if at != -1 else None


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
