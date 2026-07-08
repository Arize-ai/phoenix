"""Server version gating for the Phoenix client.

Newer Phoenix server features (routes, parameters) are declared as
``CapabilityRequirement`` constants in
``phoenix.client.constants.server_requirements``. Before calling a
gated feature, resource classes pass the requirement to a
``ServerVersionGuard`` (or its async counterpart), which lazily
fetches the server version via ``GET /arize_phoenix_version`` and
raises ``PhoenixException`` with an actionable message when the
server is too old.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple

import httpx

from phoenix.client.exceptions import PhoenixException


class Version(NamedTuple):
    major: int
    minor: int
    patch: int

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


@dataclass(frozen=True)
class RouteRequirement:
    """A route capability gated behind a minimum Phoenix server version."""

    method: str
    """HTTP method (e.g. ``'GET'``, ``'POST'``, ``'DELETE'``)."""
    path: str
    """URL path template (e.g. ``'/v1/sessions/{session_id}'``)."""
    min_server_version: Version
    """Minimum server version."""
    description: str | None = None
    """Optional human-readable description override."""

    def __str__(self) -> str:
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
    min_server_version: Version
    """Minimum server version."""
    description: str | None = None
    """Optional human-readable description override."""

    def __str__(self) -> str:
        if self.description:
            return self.description
        return f"The '{self.parameter_name}' {self.parameter_location} parameter on {self.route}"


CapabilityRequirement = RouteRequirement | ParameterRequirement


class ServerVersionGuard:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client
        self._version: Version | None = None

    def _get(self) -> Version:
        if self._version is None:
            response = self._client.get("arize_phoenix_version")
            self._version = _parse_version(response)
        return self._version

    def require(self, requirement: CapabilityRequirement) -> None:
        _check_version(self._get(), requirement)


class AsyncServerVersionGuard:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._version: Version | None = None

    async def _get(self) -> Version:
        if self._version is None:
            response = await self._client.get("arize_phoenix_version")
            self._version = _parse_version(response)
        return self._version

    async def require(self, requirement: CapabilityRequirement) -> None:
        _check_version(await self._get(), requirement)


def _parse_version(response: httpx.Response) -> Version:
    if response.is_success:
        parts = response.text.strip().split(".")
        try:
            return Version(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, IndexError):
            pass
    raise PhoenixException(
        "Phoenix server version could not be determined. "
        "Please ensure you are connecting to a supported Phoenix server."
    )


def _check_version(
    version: Version,
    requirement: CapabilityRequirement,
) -> None:
    """Raise if *server_version* does not satisfy *requirement*."""
    if version < (required := requirement.min_server_version):
        raise PhoenixException(
            f"{requirement} requires Phoenix >= {required}, "
            f"but connected to server {version}. "
            "Please upgrade your Phoenix server."
        )
