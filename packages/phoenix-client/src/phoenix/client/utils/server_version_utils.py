"""Phoenix server version utilities.

Provides guards for capabilities that require a minimum Phoenix **server** version.
The server version is detected from the ``x-phoenix-server-version`` response
header or by calling ``GET /arize_phoenix_version``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Union

from phoenix.client.types.semver import SemanticVersion
from phoenix.client.types.server_requirements import CapabilityRequirement
from phoenix.client.utils.semver_utils import format_version, satisfies_min_version

if TYPE_CHECKING:
    from phoenix.client.client import PhoenixAsyncHTTPClient, PhoenixHTTPClient


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------


def _check_version(
    server_version: Optional[SemanticVersion],
    requirement: CapabilityRequirement,
) -> None:
    """Raise if *server_version* does not satisfy *requirement*."""
    if server_version is None or not satisfies_min_version(
        server_version, requirement.min_server_version
    ):
        from phoenix.client.exceptions import PhoenixException

        required = format_version(requirement.min_server_version)
        actual = format_version(server_version) if server_version is not None else "unknown"
        raise PhoenixException(
            f"{requirement.capability} requires Phoenix >= {required}, "
            f"but connected to server {actual}. "
            "Please upgrade your Phoenix server."
        )


def ensure_server_capability(
    *,
    client: Union[PhoenixHTTPClient, PhoenixAsyncHTTPClient],
    requirement: CapabilityRequirement,
) -> None:
    """Check that *client*'s server version satisfies *requirement*.

    Eagerly fetches the server version if not yet known.
    Raises :class:`~phoenix.client.exceptions.PhoenixException` if the
    server is too old or if the version cannot be determined.
    """
    client.fetch_server_version()
    _check_version(client.server_version, requirement)


async def async_ensure_server_capability(
    *,
    client: PhoenixAsyncHTTPClient,
    requirement: CapabilityRequirement,
) -> None:
    """Async version of :func:`ensure_server_capability`."""
    await client.async_fetch_server_version()
    _check_version(client.server_version, requirement)
