"""Phoenix server version utilities.

Provides types, constants, and guards for features that require a minimum
Phoenix **server** version.  The server version is detected from the
``x-phoenix-server-version`` response header or by calling
``GET /arize_phoenix_version``.
"""

from __future__ import annotations

from typing import NamedTuple

from phoenix.client.utils.semver import SemanticVersion

ServerVersion = SemanticVersion


class FeatureRequirement(NamedTuple):
    """A feature gated behind a minimum Phoenix server version."""

    min_version: ServerVersion
    """Minimum server version as ``(major, minor, patch)``."""
    feature: str
    """Human-readable feature label used in error messages."""


SESSIONS_API = FeatureRequirement(
    min_version=(13, 14, 0),
    feature="The sessions API routes (/v1/sessions)",
)
"""All ``/v1/sessions`` routes (get, list, delete, annotations, turns)."""

TRACE_IDS_FILTER = FeatureRequirement(
    min_version=(13, 14, 0),
    feature="The 'trace_ids' query parameter on the spans endpoint",
)
"""The ``trace_ids`` query parameter on ``GET /v1/projects/{id}/spans``."""
