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

        if self._groups_attribute_path and not self._allowed_groups:
            raise ValueError(
                "allowed_groups must be specified when groups_attribute_path is configured. "
                "Group-based access control requires both parameters to be set. "
                "If you don't need group-based access control, remove groups_attribute_path."
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
        Check if the ID token contains all application-required claims.

        OIDC Core §2 mandates that ID tokens contain authentication claims (iss, sub, aud,
        exp, iat), but user profile claims (email, name, groups) are optional and may only
        be available via UserInfo endpoint (§5.4, §5.5). This method determines if we need
        to call UserInfo.

        Application-required claims:
        - email: Required for user identification and account creation
        - groups: Required if group-based access control is configured

        If any required claim is missing, returns False to trigger UserInfo endpoint call.

        Args:
            claims: Claims from ID token (OIDC Core §3.1.3.3)

        Returns:
            True if all application-required claims are present (UserInfo not needed)
            False if additional claims must be fetched from UserInfo endpoint
        """
        # Check for email claim (required by application)
        email = claims.get("email")
        if not email or not isinstance(email, str) or not email.strip():
            # Email missing or invalid, need UserInfo
            return False

        # Check for group claims if group-based access control is configured
        if self._compiled_groups_path:
            groups = self._extract_groups_from_claims(claims)
            if len(groups) == 0:
                # Groups required but not present, need UserInfo
                return False

        # All required claims present
        return True

    def validate_access(self, user_claims: dict[str, Any]) -> None:
        """
        Validate that the user has access based on configured claim-based access control.

        Currently supports group-based access control. In the future, this may be extended
        to support organization-based or other claim-based authorization mechanisms.

        Args:
            user_claims: Claims from the OIDC ID token (OIDC Core §3.1.3.3) or userinfo
                endpoint (OIDC Core §5.3). Custom claims for groups/roles are extracted
                per OIDC Core §5.1.2 (Additional Claims).

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
        # RFC 6749 §3.3: scope parameter (space-delimited list of scopes)
        client_kwargs = {"scope": config.scopes}

        if config.token_endpoint_auth_method:
            # OIDC Core §9: Client authentication method at token endpoint
            client_kwargs["token_endpoint_auth_method"] = config.token_endpoint_auth_method
        if config.use_pkce:
            # Always use S256 for PKCE (RFC 7636 §4.2: SHA-256 code challenge method)
            client_kwargs["code_challenge_method"] = "S256"

        client = OAuth2Client(
            name=config.idp_name,
            client_id=config.client_id,  # RFC 6749 §2.2
            client_secret=config.client_secret,  # RFC 6749 §2.3.1
            server_metadata_url=config.oidc_config_url,  # OIDC Discovery §4
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
