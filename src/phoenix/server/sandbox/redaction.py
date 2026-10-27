"""Span-text masking for sandbox-injected secrets.

Hygiene layer over the telemetry channel — NOT a containment boundary.
Masks only verbatim plaintext occurrences of known secret values inside
strings ``CodeEvaluatorRunner`` is about to attach to a span. Encoded
variants (base64, hex, ...), side channels, and untrusted code authors
are out of scope.
"""

from __future__ import annotations

from typing import Iterable


class SandboxSecretMasker:
    """Replace verbatim plaintext secrets with stable ``<redacted:N>`` markers.

    Secrets shorter than ``min_length`` (default 8) are ignored — collision
    rate against legitimate content is too high. Replacement order is
    longest-first so a shorter prefix cannot corrupt a longer secret's marker.
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
