"""Phoenix server version utilities.

Provides types, constants, and guards for features that require a minimum
Phoenix **server** version.  The server version is detected from the
``x-phoenix-server-version`` response header or by calling
``GET /arize_phoenix_version``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, Sequence, Union

from phoenix.client.utils.semver_utils import SemanticVersion, format_version, satisfies_min_version

if TYPE_CHECKING:
    from phoenix.client.client import PhoenixAsyncHTTPClient, PhoenixHTTPClient

ServerVersion = SemanticVersion


# ---------------------------------------------------------------------------
# Discriminated union types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RouteRequirement:
    """A route feature gated behind a minimum Phoenix server version."""

    method: str
    """HTTP method (e.g. ``'GET'``, ``'POST'``, ``'DELETE'``)."""
    path: str
    """URL path template (e.g. ``'/v1/sessions/{session_id}'``)."""
    min_version: SemanticVersion
    """Minimum server version as ``(major, minor, patch)``."""
    description: Optional[str] = None
    """Optional human-readable description override."""

    @property
    def kind(self) -> str:
        return "route"

    @property
    def feature(self) -> str:
        """Human-readable feature label for error messages."""
        if self.description:
            return self.description
        return f"The {self.method} {self.path} route"


@dataclass(frozen=True)
class ParameterRequirement:
    """A parameter feature gated behind a minimum Phoenix server version."""

    parameter_name: str
    """Name of the query/path/header parameter."""
    parameter_location: str
    """Location of the parameter (e.g. ``'query'``, ``'path'``, ``'header'``)."""
    route: str
    """The route this parameter belongs to."""
    min_version: SemanticVersion
    """Minimum server version as ``(major, minor, patch)``."""
    description: Optional[str] = None
    """Optional human-readable description override."""

    @property
    def kind(self) -> str:
        return "parameter"

    @property
    def feature(self) -> str:
        """Human-readable feature label for error messages."""
        if self.description:
            return self.description
        return f"The '{self.parameter_name}' {self.parameter_location} parameter on {self.route}"


FeatureRequirement = Union[RouteRequirement, ParameterRequirement]

# ---------------------------------------------------------------------------
# Per-route constants
# ---------------------------------------------------------------------------

GET_SESSION = RouteRequirement(
    method="GET",
    path="/v1/sessions/{session_id}",
    min_version=(13, 14, 0),
)

DELETE_SESSION = RouteRequirement(
    method="DELETE",
    path="/v1/sessions/{session_id}",
    min_version=(13, 14, 0),
)

DELETE_SESSIONS = RouteRequirement(
    method="POST",
    path="/v1/sessions/delete",
    min_version=(13, 14, 0),
)

LIST_PROJECT_SESSIONS = RouteRequirement(
    method="GET",
    path="/v1/projects/{project_id}/sessions",
    min_version=(13, 14, 0),
)

ANNOTATE_SESSIONS = RouteRequirement(
    method="POST",
    path="/v1/session_annotations",
    min_version=(13, 14, 0),
)

GET_SPANS_TRACE_IDS = ParameterRequirement(
    parameter_name="trace_ids",
    parameter_location="query",
    route="GET /v1/projects/{id}/spans",
    min_version=(13, 14, 0),
)

ALL_REQUIREMENTS: Sequence[FeatureRequirement] = (
    GET_SESSION,
    DELETE_SESSION,
    DELETE_SESSIONS,
    LIST_PROJECT_SESSIONS,
    ANNOTATE_SESSIONS,
    GET_SPANS_TRACE_IDS,
)


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------


def ensure_server_feature(
    client: Union[PhoenixHTTPClient, PhoenixAsyncHTTPClient],
    requirement: FeatureRequirement,
) -> None:
    """Check that *client*'s server version satisfies *requirement*.

    Eagerly fetches the server version if not yet known.
    Raises :class:`~phoenix.client.exceptions.PhoenixException` if the
    server is too old.  Does nothing if the version cannot be determined
    (to avoid blocking users on older servers).
    """
    client._fetch_server_version()
    sv = client.server_version
    if sv is None:
        return
    if not satisfies_min_version(sv, requirement.min_version):
        from phoenix.client.exceptions import PhoenixException

        v = format_version(requirement.min_version)
        raise PhoenixException(
            f"{requirement.feature} requires Phoenix >= {v}, "
            f"but connected to server {format_version(sv)}. "
            "Please upgrade your Phoenix server."
        )


async def async_ensure_server_feature(
    client: PhoenixAsyncHTTPClient,
    requirement: FeatureRequirement,
) -> None:
    """Async version of :func:`ensure_server_feature`."""
    await client._async_fetch_server_version()
    sv = client.server_version
    if sv is None:
        return
    if not satisfies_min_version(sv, requirement.min_version):
        from phoenix.client.exceptions import PhoenixException

        v = format_version(requirement.min_version)
        raise PhoenixException(
            f"{requirement.feature} requires Phoenix >= {v}, "
            f"but connected to server {format_version(sv)}. "
            "Please upgrade your Phoenix server."
        )
