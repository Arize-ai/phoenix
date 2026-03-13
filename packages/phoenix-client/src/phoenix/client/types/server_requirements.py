"""Capability requirement types for Phoenix server version gating.

A "capability" represents a specific server-side feature — such as an HTTP
route or query parameter — that is gated behind a minimum Phoenix server
version.  Each :data:`CapabilityRequirement` declares *what* the capability
is (via its :attr:`capability` label) and *which* server version first
introduced it.

The client checks these requirements at call time via
:func:`~phoenix.client.utils.server_version_utils.ensure_server_capability`
so that callers get a clear, actionable error instead of an opaque 404 or
400 from an older server.

There are two concrete requirement types:

* :class:`RouteRequirement` — an entire HTTP endpoint (method + path).
* :class:`ParameterRequirement` — a specific query/path/header parameter on
  an existing route.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Union

from phoenix.client.types.semver import SemanticVersion

ServerVersion = SemanticVersion


@dataclass(frozen=True)
class RouteRequirement:
    """A route capability gated behind a minimum Phoenix server version."""

    method: str
    """HTTP method (e.g. ``'GET'``, ``'POST'``, ``'DELETE'``)."""
    path: str
    """URL path template (e.g. ``'/v1/sessions/{session_id}'``)."""
    min_server_version: SemanticVersion
    """Minimum server version as ``(major, minor, patch)``."""
    description: Optional[str] = None
    """Optional human-readable description override."""

    @property
    def kind(self) -> Literal["route"]:
        return "route"

    @property
    def capability(self) -> str:
        """Human-readable capability label for error messages."""
        if self.description:
            return self.description
        return f"The {self.method} {self.path} route"


@dataclass(frozen=True)
class ParameterRequirement:
    """A parameter capability gated behind a minimum Phoenix server version."""

    parameter_name: str
    """Name of the query/path/header parameter."""
    parameter_location: str
    """Location of the parameter (e.g. ``'query'``, ``'path'``, ``'header'``)."""
    route: str
    """The route this parameter belongs to."""
    min_server_version: SemanticVersion
    """Minimum server version as ``(major, minor, patch)``."""
    description: Optional[str] = None
    """Optional human-readable description override."""

    @property
    def kind(self) -> Literal["parameter"]:
        return "parameter"

    @property
    def capability(self) -> str:
        """Human-readable capability label for error messages."""
        if self.description:
            return self.description
        return f"The '{self.parameter_name}' {self.parameter_location} parameter on {self.route}"


CapabilityRequirement = Union[RouteRequirement, ParameterRequirement]
