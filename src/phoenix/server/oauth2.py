from datetime import datetime, timedelta
from typing import Any, Dict, Generic, Iterable, Optional, Tuple

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.starlette_client import StarletteOAuth2App as OAuth2Client
from typing_extensions import TypeAlias, TypeVar

from phoenix.config import OAuth2ClientConfig


class OAuth2Clients:
    def __init__(self) -> None:
        self._clients: Dict[str, OAuth2Client] = {}
        self._oauth = OAuth(cache=_OAuth2ClientTTLCache[str, Any]())

    def add_client(self, config: OAuth2ClientConfig) -> None:
        if (idp_name := config.idp_name) in self._clients:
            raise ValueError(f"oauth client already registered: {idp_name}")
        client = self._oauth.register(
            idp_name,
            client_id=config.client_id,
            client_secret=config.client_secret,
            server_metadata_url=config.server_metadata_url,
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


_CacheKey = TypeVar("_CacheKey")
_CacheValue = TypeVar("_CacheValue")
_Expiry: TypeAlias = datetime
_MINUTE = timedelta(minutes=1)


class _OAuth2ClientTTLCache(Generic[_CacheKey, _CacheValue]):
    """
    A TTL cache satisfying the interface required by the Authlib Starlette
    integration. Provides an alternative to starlette session middleware.
    """

    def __init__(self, cleanup_interval: timedelta = 1 * _MINUTE) -> None:
        self._data: Dict[_CacheKey, Tuple[_CacheValue, _Expiry]] = {}
        self._last_cleanup_time = datetime.now()
        self._cleanup_interval = cleanup_interval

    async def get(self, key: _CacheKey) -> Optional[_CacheValue]:
        """
        Retrieves the value associated with the given key if it exists and has
        not expired, otherwise, returns None.
        """
        self._remove_expired_keys_if_cleanup_interval_exceeded()
        if (value_and_expiry := self._data.get(key)) is None:
            return None
        value, expiry = value_and_expiry
        if datetime.now() < expiry:
            return value
        self._data.pop(key, None)
        return None

    async def set(self, key: _CacheKey, value: _CacheValue, expires: int) -> None:
        """
        Sets the value associated with the given key to the provided value with
        the given expiry time in seconds.
        """
        self._remove_expired_keys_if_cleanup_interval_exceeded()
        expiry = datetime.now() + timedelta(seconds=expires)
        self._data[key] = (value, expiry)

    async def delete(self, key: _CacheKey) -> None:
        """
        Removes the value associated with the given key if it exists.
        """
        self._remove_expired_keys_if_cleanup_interval_exceeded()
        self._data.pop(key, None)

    def _remove_expired_keys_if_cleanup_interval_exceeded(self) -> None:
        time_since_last_cleanup = datetime.now() - self._last_cleanup_time
        if time_since_last_cleanup > self._cleanup_interval:
            self._remove_expired_keys()

    def _remove_expired_keys(self) -> None:
        current_time = datetime.now()
        delete_keys = [key for key, (_, expiry) in self._data.items() if expiry <= current_time]
        for key in delete_keys:
            self._data.pop(key, None)
        self._last_cleanup_time = current_time
