from collections.abc import Iterable
from typing import Any

from authlib.integrations.base_client import BaseApp
from authlib.integrations.base_client.async_app import AsyncOAuth2Mixin
from authlib.integrations.base_client.async_openid import AsyncOpenIDMixin
from authlib.integrations.httpx_client import AsyncOAuth2Client as AsyncHttpxOAuth2Client

from phoenix.config import OAuth2ClientConfig


class OAuth2Client(AsyncOAuth2Mixin, AsyncOpenIDMixin, BaseApp):  # type:ignore[misc]
    """
    An OAuth2 client class that supports OpenID Connect. Adapted from authlib's
    `StarletteOAuth2App` to be useable without integration with Starlette.

    https://github.com/lepture/authlib/blob/904d66bebd79bf39fb8814353a22bab7d3e092c4/authlib/integrations/starlette_client/apps.py#L58
    """

    client_cls = AsyncHttpxOAuth2Client

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(framework=None, *args, **kwargs)


class OAuth2Clients:
    def __init__(self) -> None:
        self._clients: dict[str, OAuth2Client] = {}

    def add_client(self, config: OAuth2ClientConfig) -> None:
        if (idp_name := config.idp_name) in self._clients:
            raise ValueError(f"oauth client already registered: {idp_name}")
        client = OAuth2Client(
            client_id=config.client_id,
            client_secret=config.client_secret,
            server_metadata_url=config.oidc_config_url,
            client_kwargs={"scope": "openid email profile"},
        )
        assert isinstance(client, OAuth2Client)
        self._clients[config.idp_name] = client

    def get_client(self, idp_name: str) -> OAuth2Client:
        if (client := self._clients.get(idp_name)) is None:
            raise ValueError(f"unknown or unregistered OAuth2 client: {idp_name}")
        return client

    @classmethod
    def from_configs(cls, configs: Iterable[OAuth2ClientConfig]) -> "OAuth2Clients":
        oauth2_clients = cls()
        for config in configs:
            oauth2_clients.add_client(config)
        return oauth2_clients
