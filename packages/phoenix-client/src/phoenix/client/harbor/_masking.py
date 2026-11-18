# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
"""Mask API keys and secret environment values before Harbor data reaches Phoenix."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any, TypeVar, cast

from harbor.utils.env import is_sensitive_env_key, resolve_env_vars

__all__ = [
    "MASKED_SECRET",
    "SecretMasker",
    "collect_secret_values",
]

MASKED_SECRET = "<redacted>"

# OpenAI keys (``sk-``, ``sk-proj-``, ``sk-svcacct-``) and Anthropic keys
# (``sk-ant-``) share the ``sk-`` prefix. The lookbehind skips words such as
# ``task-`` that end in ``sk``.
_PROVIDER_KEY = re.compile(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}")
# Shorter values of secret-named variables are usually flags or placeholders, and
# masking them would also mask ordinary words in trajectories.
_MIN_SECRET_VALUE_LENGTH = 8

_T = TypeVar("_T")


def collect_secret_values(
    *,
    environments: Iterable[Mapping[str, str]],
    extra_values: Iterable[str | None] = (),
) -> frozenset[str]:
    """Returns the values of secret-named variables in ``environments``, plus ``extra_values``.

    A variable is secret-named when Harbor redacts it from saved job
    configurations, such as ``OPENAI_API_KEY`` or ``GITHUB_TOKEN``. Templates
    such as ``${OPENAI_API_KEY}`` resolve against the process environment.
    Values shorter than 8 characters are skipped.
    """
    values = {value for value in extra_values if value}
    for environment in environments:
        for name, value in environment.items():
            if not is_sensitive_env_key(name):
                continue
            try:
                values.add(resolve_env_vars({name: value})[name])
            except ValueError:
                # The template names a variable this process doesn't have.
                continue
    return frozenset(value for value in values if len(value) >= _MIN_SECRET_VALUE_LENGTH)


class SecretMasker:
    """A replacer of API keys and known secret values with ``MASKED_SECRET``."""

    def __init__(self, secret_values: Iterable[str] = ()) -> None:
        # Longer values come first, so a secret that contains another is masked whole.
        ordered = sorted(set(secret_values), key=len, reverse=True)
        self._known_values = re.compile("|".join(map(re.escape, ordered))) if ordered else None

    def mask(self, value: _T) -> _T:
        """Returns a copy of ``value`` with secrets in its strings replaced.

        Strings in mappings, lists, and tuples are masked recursively, including
        mapping keys. Other values are returned unchanged.
        """
        return cast(_T, self._mask(value))

    def _mask(self, value: Any) -> Any:
        if isinstance(value, str):
            return self._mask_text(value)
        if isinstance(value, Mapping):
            return {self._mask(key): self._mask(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._mask(item) for item in value]
        if isinstance(value, tuple):
            return tuple(self._mask(item) for item in value)
        return value

    def _mask_text(self, text: str) -> str:
        if self._known_values is not None:
            text = self._known_values.sub(MASKED_SECRET, text)
        return _PROVIDER_KEY.sub(MASKED_SECRET, text)
