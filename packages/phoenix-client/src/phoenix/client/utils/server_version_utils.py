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


def ensure_server_feature(
    client: Union["PhoenixHTTPClient", "PhoenixAsyncHTTPClient"],
    requirement: FeatureRequirement,
) -> None:
    """Check that *client*'s server version satisfies *requirement*.

    Eagerly fetches the server version if not yet known.
    Raises :class:`~phoenix.client.exceptions.PhoenixException` if the
    server is too old.  Does nothing if the version cannot be determined
    (to avoid blocking users on older servers).

    Args:
        client: The Phoenix HTTP client instance.
        requirement: The feature requirement specifying the minimum server version.

    Raises:
        PhoenixException: If the server version is known and does not satisfy
            the minimum version required by *requirement*.
    """
    client._fetch_server_version()  # pyright: ignore[reportPrivateUsage]
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
    client: "PhoenixAsyncHTTPClient",
    requirement: FeatureRequirement,
) -> None:
    """Async version of :func:`ensure_server_feature`.

    Args:
        client: The Phoenix async HTTP client instance.
        requirement: The feature requirement specifying the minimum server version.

    Raises:
        PhoenixException: If the server version is known and does not satisfy
            the minimum version required by *requirement*.
    """
    await client._async_fetch_server_version()  # pyright: ignore[reportPrivateUsage]
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
