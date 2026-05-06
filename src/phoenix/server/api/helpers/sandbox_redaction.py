"""Shared redaction for sandbox-config secret material.

Snapshot rows are redacted at write time (no plaintext literals at rest).
``value_digest`` preserves rotation-triggers-version semantics for
``has_identical_content``. The runtime evaluator paths source
``backend_type``/``config``/``timeout`` from the live tip's
``SandboxConfig``/``SandboxProvider``, not from the snapshot.
"""

from __future__ import annotations

import hashlib
from typing import Any

REDACTED_ENV_VAR_VALUE = "<redacted>"


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


def redact_sandbox_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Apply :func:`redact_env_var_literals` to the snapshot's ``config`` block."""
    config = snapshot.get("config")
    if not isinstance(config, dict):
        return snapshot
    return {**snapshot, "config": redact_env_var_literals(config)}
