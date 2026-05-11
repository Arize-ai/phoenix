"""Shared redaction for sandbox-config secret material.

``redact_env_var_literals`` is used by the ``SandboxConfig.config`` GraphQL
resolver to redact literal env-var values at read time.

``SandboxSecretMasker`` masks verbatim plaintext secrets from OTEL span
attributes, status descriptions, and exception events emitted by
``CodeEvaluatorRunner``.

Threat model
------------

The masker is a hygiene layer over the telemetry channel — NOT a containment
boundary. The code author is trusted; provider credentials and user-defined
env vars are intentionally injected into the sandbox at execute time. The
masker exists because provider SDKs and user code routinely echo those
plaintexts back to the server in places we then persist (stdout/stderr in
``OUTPUT_VALUE``, an HTTP 401's response body in an exception message, a
stack trace that captured a kwarg, etc.). Without masking, those secrets
land in the spans table and are visible to anyone with trace-read access.

In scope:
    Verbatim plaintext occurrences of known secret values inside strings
    that ``CodeEvaluatorRunner`` is about to attach to a span. "Known" =
    the backend's ``secret_values`` set, composed in each backend's
    ``__init__`` via ``compose_secret_values(user_env, *credentials)``
    (see ``sandbox/types.py``). Substring match, ``min_length=8``,
    longest-first replacement.

Out of scope (and not fixable by extending this class):
    - Adversarial code that transforms a secret before printing it (base64,
      hex, URL-encoding, character-by-character, XOR, ...). A perfect
      transform-aware masker is impossible; each new encoding the attacker
      picks is one the masker doesn't know.
    - Side channels: outbound HTTP to an attacker-controlled host, timing,
      writing to a file the author later reads back, embedding the secret
      in a return value that goes through a different code path, etc.
    - Untrusted authors. If you don't trust whoever wrote the evaluator
      code, do not inject their secrets into the sandbox. The trust
      boundary is authorship, not the masker.

A future contributor proposing to add encoded-variant detection (base64,
hex, ...) should re-read this section first. It expands attack surface
(more regex, more false positives masking legitimate content that happens
to contain a secret's base64 representation) without closing any real gap
for the threat model above, because variant N+1 always exists.
"""

from __future__ import annotations

import hashlib
from typing import Any, Iterable

REDACTED_ENV_VAR_VALUE = "<redacted>"


class SandboxSecretMasker:
    """Replace verbatim plaintext secrets in strings with stable ``<redacted:N>`` markers.

    Secrets shorter than ``min_length`` (default 8) are ignored — empty strings
    and short strings have too high a collision rate with legitimate content.
    Replacement order is longest-first with lexical tie-break so that a shorter
    prefix of a longer secret cannot corrupt the longer secret's marker.
    """

    def __init__(
        self,
        secret_values: Iterable[str],
        *,
        min_length: int = 8,
    ) -> None:
        filtered = sorted(
            (s for s in secret_values if s and len(s) >= min_length),
            key=lambda s: (-len(s), s),
        )
        self._secrets: tuple[str, ...] = tuple(filtered)

    def mask(self, text: str) -> str:
        for idx, secret in enumerate(self._secrets):
            text = text.replace(secret, f"<redacted:{idx}>")
        return text


def redact_env_var_literals(config: Any) -> Any:
    """Return a copy of ``config`` with literal env-var values redacted.

    Literal entries keep ``kind: "literal"`` and ``name`` unchanged, expose
    ``value: "<redacted>"``, and gain a 16-hex-char ``value_digest`` so
    callers can detect rotation. Secret-ref entries pass through. The input
    is not mutated.
    """
    if not isinstance(config, dict):
        return config
    env_vars = config.get("env_vars")
    if not isinstance(env_vars, list):
        return config
    redacted_env_vars: list[Any] = []
    for entry in env_vars:
        if isinstance(entry, dict) and entry.get("kind") == "literal":
            redacted_entry = dict(entry)
            raw_value = entry.get("value", "")
            value_bytes = raw_value.encode("utf-8") if isinstance(raw_value, str) else b""
            redacted_entry["value"] = REDACTED_ENV_VAR_VALUE
            redacted_entry["value_digest"] = hashlib.sha256(value_bytes).hexdigest()[:16]
            redacted_env_vars.append(redacted_entry)
        else:
            redacted_env_vars.append(entry)
    return {**config, "env_vars": redacted_env_vars}
