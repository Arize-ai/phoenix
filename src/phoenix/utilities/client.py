import warnings
from typing import Any

import httpx

PHOENIX_SERVER_VERSION_HEADER = "x-phoenix-server-version"


class VersionedClient(httpx.Client):
    """
    A httpx.Client wrapper that warns if there is a server/client version mismatch.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        from phoenix import __version__ as phoenix_version

        super().__init__(*args, **kwargs)
        self._client_phoenix_version = phoenix_version
        self._warned_on_minor_version_mismatch = False

    def _check_version(self, response: httpx.Response) -> None:
        server_version = response.headers.get(PHOENIX_SERVER_VERSION_HEADER)

        if server_version is None:
            warnings.warn(
                "The Phoenix server has an unknown version and may have compatibility issues."
            )
            return

        try:
            client_major, client_minor, client_patch = map(
                int, self._client_phoenix_version.split(".")
            )
            server_major, server_minor, server_patch = map(int, server_version.split("."))
            if abs(server_major - client_major) >= 1:
                warnings.warn(
                    f"⚠️⚠️ The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are severely mismatched. Upgrade "
                    " either the client or server to ensure API compatibility ⚠️⚠️"
                )
            elif (
                abs(server_minor - client_minor) >= 1 and not self._warned_on_minor_version_mismatch
            ):
                self._warned_on_minor_version_mismatch = True
                warnings.warn(
                    f"The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are mismatched and may have "
                    "compatibility issues."
                )
        except ValueError:
            # if either the client or server version includes a suffix e.g. "rc1", check for an
            # exact version match of the version string
            if self._client_phoenix_version != server_version:
                warnings.warn(
                    f"The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are mismatched and may have "
                    "compatibility issues."
                )

    def request(self, *args: Any, **kwargs: Any) -> httpx.Response:
        response = super().request(*args, **kwargs)
        self._check_version(response)
        return response


class VersionedAsyncClient(httpx.AsyncClient):
    """
    A httpx.Client wrapper that warns if there is a server/client version mismatch.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        from phoenix import __version__ as phoenix_version

        super().__init__(*args, **kwargs)
        self._client_phoenix_version = phoenix_version
        self._warned_on_minor_version_mismatch = False

    def _check_version(self, response: httpx.Response) -> None:
        server_version = response.headers.get(PHOENIX_SERVER_VERSION_HEADER)

        if server_version is None:
            return

        try:
            client_major, client_minor, client_patch = map(
                int, self._client_phoenix_version.split(".")
            )
            server_major, server_minor, server_patch = map(int, server_version.split("."))
            if abs(server_major - client_major) >= 1:
                warnings.warn(
                    f"⚠️⚠️ The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are severely mismatched. Upgrade "
                    " either the client or server to ensure API compatibility ⚠️⚠️"
                )
            elif (
                abs(server_minor - client_minor) >= 1 and not self._warned_on_minor_version_mismatch
            ):
                self._warned_on_minor_version_mismatch = True
                warnings.warn(
                    f"The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are mismatched and may have "
                    "compatibility issues."
                )
        except ValueError:
            # if the version includes a suffix e.g. "rc1", check for an exact version match
            if self._client_phoenix_version != server_version:
                warnings.warn(
                    f"The Phoenix server ({server_version}) and client "
                    f"({self._client_phoenix_version}) versions are mismatched and may have "
                    "compatibility issues."
                )

    async def request(self, *args: Any, **kwargs: Any) -> httpx.Response:
        response = await super().request(*args, **kwargs)
        self._check_version(response)
        return response
