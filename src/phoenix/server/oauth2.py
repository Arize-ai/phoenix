from collections.abc import Iterable
from typing import Any, Iterator, Optional

import jmespath
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

    def __init__(
        self,
        *args: Any,
        display_name: str,
        allow_sign_up: bool,
        auto_login: bool,
        use_pkce: bool = False,
        groups_attribute_path: Optional[str] = None,
        allowed_groups: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> None:
        self._display_name = display_name
        self._allow_sign_up = allow_sign_up
        self._auto_login = auto_login
        self._use_pkce = use_pkce

        self._groups_attribute_path = (
            groups_attribute_path.strip()
            if groups_attribute_path and groups_attribute_path.strip()
            else None
        )

        if allowed_groups:
            self._allowed_groups = {g for g in allowed_groups if g.strip()}
        else:
            self._allowed_groups = set()

        if self._allowed_groups and not self._groups_attribute_path:
            raise ValueError(
                "groups_attribute_path must be specified when allowed_groups is configured. "
                "Group-based access control requires both parameters to be set."
            )

        self._compiled_groups_path = self._compile_jmespath_expression(self._groups_attribute_path)
        super().__init__(framework=None, *args, **kwargs)

    @staticmethod
    def _compile_jmespath_expression(path: Optional[str]) -> Optional[jmespath.parser.ParsedResult]:
        """Validate and compile JMESPath expression at startup for fail-fast behavior."""
        if not path:
            return None

        try:
            return jmespath.compile(path)
        except (jmespath.exceptions.JMESPathError, jmespath.exceptions.ParseError) as e:
            raise ValueError(
                f"Invalid JMESPath expression in GROUPS_ATTRIBUTE_PATH: '{path}'. Error: {e}. "
                "Hint: Claim keys with special characters (colons, dots, slashes, hyphens) "
                "must be enclosed in double quotes. "
                "Examples: '\"cognito:groups\"', '\"https://myapp.com/groups\"'"
            ) from e

    @property
    def allow_sign_up(self) -> bool:
        return self._allow_sign_up

    @property
    def auto_login(self) -> bool:
        return self._auto_login

    @property
    def display_name(self) -> str:
        return self._display_name

    @property
    def use_pkce(self) -> bool:
        return self._use_pkce

    def has_sufficient_claims(self, claims: dict[str, Any]) -> bool:
        """
        Check if the provided claims contain all necessary information for authorization.

        Currently checks for group claims when group-based access control is configured.
        Returns True if no additional claims are needed from the userinfo endpoint.

        Args:
            claims: Claims from ID token or userinfo endpoint

        Returns:
            True if claims are sufficient for authorization, False if userinfo is needed
        """
        if not self._compiled_groups_path:
            return True

        groups = self._extract_groups_from_claims(claims)
        return len(groups) > 0

    def validate_access(self, user_claims: dict[str, Any]) -> None:
        """
        Validate that the user has access based on configured claim-based access control.

        Currently supports group-based access control. In the future, this may be extended
        to support organization-based or other claim-based authorization mechanisms.

        Args:
            user_claims: Claims from the OIDC ID token or userinfo endpoint

        Raises:
            PermissionError: If user doesn't meet the access requirements
        """
        if not self._allowed_groups or not self._groups_attribute_path:
            return

        user_groups = self._extract_groups_from_claims(user_claims)

        if not any(group in self._allowed_groups for group in user_groups):
            raise PermissionError(
                "Access denied. Your account does not belong to any authorized groups."
            )

    def _extract_groups_from_claims(self, claims: dict[str, Any]) -> list[str]:
        """Extract group values from claims using the configured JMESPath expression."""
        if not self._compiled_groups_path:
            return []

        result = self._compiled_groups_path.search(claims)
        return self._normalize_to_string_list(result)

    @staticmethod
    def _normalize_to_string_list(value: Any) -> list[str]:
        """
        Normalize a JMESPath result to a list of strings.

        Handles common OIDC claim formats: single values, lists, and scalar types.
        Non-scalar items (dicts, nested lists) are silently skipped.

        Args:
            value: Result from JMESPath query

        Returns:
            List of string values, or empty list if value cannot be normalized
        """
        if value is None:
            return []

        if isinstance(value, str):
            return [value]

        if isinstance(value, (int, float, bool)):
            return [str(value)]

        if isinstance(value, list):
            return [
                str(item) if isinstance(item, (int, float, bool)) else item
                for item in value
                if isinstance(item, (str, int, float, bool))
            ]

        return []


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

        if config.token_endpoint_auth_method:
            client_kwargs["token_endpoint_auth_method"] = config.token_endpoint_auth_method
        if config.use_pkce:
            # Always use S256 for PKCE
            client_kwargs["code_challenge_method"] = "S256"

        client = OAuth2Client(
            name=config.idp_name,
            client_id=config.client_id,
            client_secret=config.client_secret,
            server_metadata_url=config.oidc_config_url,
            client_kwargs=client_kwargs,
            display_name=config.idp_display_name,
            allow_sign_up=config.allow_sign_up,
            auto_login=config.auto_login,
            use_pkce=config.use_pkce,
            groups_attribute_path=config.groups_attribute_path,
            allowed_groups=config.allowed_groups,
        )

        if config.auto_login:
            if self._auto_login_client:
                raise ValueError("only one auto-login client is allowed")
            self._auto_login_client = client
        self._clients[config.idp_name] = client

    def get_client(self, idp_name: str) -> Optional[OAuth2Client]:
        return self._clients.get(idp_name)

    @classmethod
    def from_configs(cls, configs: Iterable[OAuth2ClientConfig]) -> "OAuth2Clients":
        oauth2_clients = cls()
        for config in configs:
            oauth2_clients.add_client(config)
        return oauth2_clients
