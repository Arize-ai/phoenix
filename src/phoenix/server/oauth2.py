from collections.abc import Iterable
from typing import Any, Iterator, Optional

from authlib.integrations.base_client import BaseApp
from authlib.integrations.base_client.async_app import AsyncOAuth2Mixin
from authlib.integrations.base_client.async_openid import AsyncOpenIDMixin
from authlib.integrations.httpx_client import AsyncOAuth2Client as AsyncHttpxOAuth2Client
import base64
import logging
import sys
log = logging.getLogger(__name__)
log.addHandler(logging.StreamHandler(sys.stdout))
log.setLevel(logging.DEBUG)
from phoenix.config import OAuth2ClientConfig



#log = logging.getLogger('httpcore')

#log.addHandler(logging.StreamHandler(sys.stdout))
#log.setLevel(logging.DEBUG)


#log = logging.getLogger('h11')
#
#log.addHandler(logging.StreamHandler(sys.stdout))
#log.setLevel(logging.DEBUG)

#log = logging.getLogger('anyio')

#log.addHandler(logging.StreamHandler(sys.stdout))
#log.setLevel(logging.DEBUG)
from httpx import USE_CLIENT_DEFAULT

class CustomAsyncHttpxOAuth2Client(AsyncHttpxOAuth2Client):
    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        #self.log = logging.getLogger('httpx')
        #self.log.addHandler(logging.StreamHandler(sys.stdout))
        #self.log.setLevel(logging.DEBUG)

    async def _fetch_token(
        self,
        url,
        body="",
        headers=None,
        auth=None,
        method="POST",
        **kwargs,
    ):
        auth = None
        log.debug(f"Fetching token from {url}")
        log.debug(f"Body: {body}")
        log.debug(f"Headers: {headers}")
        log.debug(f"Auth: {auth}")
        log.debug(f"Method: {method}")
        log.debug(f"kwargs: {kwargs}")
        return await super()._fetch_token(url, body, headers, auth, method, **kwargs)

class OAuth2Client(AsyncOAuth2Mixin, AsyncOpenIDMixin, BaseApp):  # type:ignore[misc]
    """
    An OAuth2 client class that supports OpenID Connect. Adapted from authlib's
    `StarletteOAuth2App` to be useable without integration with Starlette.

    https://github.com/lepture/authlib/blob/904d66bebd79bf39fb8814353a22bab7d3e092c4/authlib/integrations/starlette_client/apps.py#L58
    """

    client_cls = CustomAsyncHttpxOAuth2Client

    def __init__(
        self,
        *args: Any,
        display_name: str,
        allow_sign_up: bool,
        auto_login: bool,
        **kwargs: Any,
    ) -> None:
        self._display_name = display_name
        self._allow_sign_up = allow_sign_up
        self._auto_login = auto_login
        super().__init__(framework=None, *args, **kwargs)
        self._allow_sign_up = allow_sign_up

    @property
    def allow_sign_up(self) -> bool:
        return self._allow_sign_up

    @property
    def auto_login(self) -> bool:
        return self._auto_login

    @property
    def display_name(self) -> str:
        return self._display_name


class OAuth2Clients:
    def __init__(self) -> None:
        self._clients: dict[str, OAuth2Client] = {}
        self._auto_login_client: Optional[OAuth2Client] = None

    def __bool__(self) -> bool:
        return bool(self._clients)

    def __len__(self) -> int:
        return len(self._clients)

    def __iter__(self) -> Iterator[OAuth2Client]:
        return iter(self._clients.values())

    @property
    def auto_login_client(self) -> Optional[OAuth2Client]:
        return self._auto_login_client

    def add_client(self, config: OAuth2ClientConfig) -> None:
        if (idp_name := config.idp_name) in self._clients:
            raise ValueError(f"oauth client already registered: {idp_name}")
        client_kwargs = {"scope": config.scopes}
        if config.code_challenge_method:
            client_kwargs["code_challenge_method"] = config.code_challenge_method
        
        
        client = OAuth2Client(
            name=config.idp_name,
            client_id=config.client_id,
            client_secret=config.client_secret,
            server_metadata_url=config.oidc_config_url,
            client_kwargs=client_kwargs,
            display_name=config.idp_display_name,
            allow_sign_up=config.allow_sign_up,
            auto_login=config.auto_login,
        )

        if config.auto_login:
            if self._auto_login_client:
                raise ValueError("only one auto-login client is allowed")
            self._auto_login_client = client
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
