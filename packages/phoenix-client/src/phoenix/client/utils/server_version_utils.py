"""Phoenix server version utilities.

Provides guards for features that require a minimum Phoenix **server** version.
The server version is detected from the ``x-phoenix-server-version`` response
header or by calling ``GET /arize_phoenix_version``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Union

from phoenix.client.types.server_requirements import FeatureRequirement
from phoenix.client.utils.semver_utils import format_version, satisfies_min_version

if TYPE_CHECKING:
    from phoenix.client.client import PhoenixAsyncHTTPClient, PhoenixHTTPClient


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
    server is too old or if the version cannot be determined.
    """
    client.fetch_server_version()
    server_version = client.server_version
    if server_version is None or not satisfies_min_version(
        server_version, requirement.min_server_version
    ):
        from phoenix.client.exceptions import PhoenixException

        required = format_version(requirement.min_server_version)
        actual = format_version(server_version) if server_version is not None else "unknown"
        raise PhoenixException(
            f"{requirement.feature} requires Phoenix >= {required}, "
            f"but connected to server {actual}. "
            "Please upgrade your Phoenix server."
        )


async def async_ensure_server_feature(
    client: PhoenixAsyncHTTPClient,
    requirement: FeatureRequirement,
) -> None:
    """Async version of :func:`ensure_server_feature`."""
    await client.async_fetch_server_version()
    server_version = client.server_version
    if server_version is None or not satisfies_min_version(
        server_version, requirement.min_server_version
    ):
        from phoenix.client.exceptions import PhoenixException

        required = format_version(requirement.min_server_version)
        actual = format_version(server_version) if server_version is not None else "unknown"
        raise PhoenixException(
            f"{requirement.feature} requires Phoenix >= {required}, "
            f"but connected to server {actual}. "
            "Please upgrade your Phoenix server."
        )
