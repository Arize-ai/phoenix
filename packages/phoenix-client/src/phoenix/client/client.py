from __future__ import annotations

from typing import Mapping, Optional

import httpx

from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.utils.config import get_base_url, get_env_client_headers


class Client:
    def __init__(
        self,
        *,
        base_url: str | httpx.URL | None = None,
        api_key: str | None = None,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.Client | None = None,
    ):
        """
        Initializes a Client instance.

        Args:
            base_url (Optional[str]): The base URL for the API endpoint. If not provided, it will
                be read from the environment variables or fall back to http://localhost:6006/.
            api_key (Optional[str]): The API key for authentication. If provided, it will be
                included in the Authorization header as a bearer token. Defaults to None.
            headers (Optional[Mapping[str, str]]): Additional headers to be included in the HTTP.
                Defaults to None. This is ignored if http_client is provided. Additional headers
                may be added from the environment variables, but won't override specified values.
            http_client (Optional[httpx.Client]): An instance of httpx.Client to be used for
                making HTTP requests. If not provided, a new instance will be created. Defaults
                to None.
        """
        if http_client is None:
            base_url = base_url or get_base_url()
            http_client = _WrappedClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
            )
        self._prompts = Prompts(http_client)

    @property
    def prompts(self) -> Prompts:
        """
        Returns an instance of the Prompts class for interacting with prompt-related API endpoints.

        Returns:
            Prompts: An instance of the Prompts class.
        """
        return self._prompts


class AsyncClient:
    def __init__(
        self,
        *,
        base_url: str | httpx.URL | None = None,
        api_key: str | None = None,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ):
        """
        Initializes an Asynchronous Client instance.

        Args:
            base_url (Optional[str]): The base URL for the API endpoint. If not provided, it will
                be read from the environment variables or fall back to http://localhost:6006/.
            api_key (Optional[str]): The API key for authentication. If provided, it will be
                included in the Authorization header as a bearer token. Defaults to None.
            headers (Optional[Mapping[str, str]]): Additional headers to be included in the HTTP.
                Defaults to None. This is ignored if http_client is provided. Additional headers
                may be added from the environment variables, but won't override specified values.
            http_client (Optional[httpx.AsyncClient]): An instance of httpx.AsyncClient to be used
                for making HTTP requests. If not provided, a new instance will be created. Defaults
                to None.
        """
        if http_client is None:
            base_url = base_url or get_base_url()
            http_client = httpx.AsyncClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
            )
        self._prompts = AsyncPrompts(http_client)

    @property
    def prompts(self) -> AsyncPrompts:
        """
        Returns an instance of the Asynchronous Prompts class for interacting with prompt-related
        API endpoints.

        Returns:
            AsyncPrompts: An instance of the Prompts class.
        """
        return self._prompts


def _update_headers(
    headers: Optional[Mapping[str, str]],
    api_key: Optional[str],
) -> dict[str, str]:
    headers = dict(headers or {})
    for k, v in get_env_client_headers().items():
        if k not in headers:
            headers[k] = v
    if api_key:
        headers = {
            **{k: v for k, v in (headers or {}).items() if k.lower() != "authorization"},
            "Authorization": f"Bearer {api_key}",
        }
    return headers


class _WrappedClient(httpx.Client):
    def __del__(self) -> None:
        try:
            self.close()
        except BaseException:
            pass
