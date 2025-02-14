from typing import Any, Mapping, Optional

import httpx

from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.utils.config import (
    get_base_url,
    get_env_client_headers,
)


class Client:
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        warn_if_server_not_running: bool = True,
        headers: Optional[Mapping[str, str]] = None,
        api_key: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
        **kwargs: Any,
    ):
        if http_client is None:
            base_url = endpoint or get_base_url()
            http_client = _WrappedClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
            )
        self.prompts = Prompts(http_client)


class AsyncClient:
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        warn_if_server_not_running: bool = True,
        headers: Optional[Mapping[str, str]] = None,
        api_key: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
        **kwargs: Any,
    ):
        if http_client is None:
            base_url = endpoint or get_base_url()
            http_client = httpx.AsyncClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
            )
        self.prompts = AsyncPrompts(http_client)


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
