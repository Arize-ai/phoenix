import logging
import os
import stat
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Any, Iterator, Optional, get_args
from urllib.parse import parse_qs

import jmespath
from authlib.common.urls import add_params_to_qs
from authlib.integrations.base_client import BaseApp, OAuthError
from authlib.integrations.base_client.async_app import AsyncOAuth2Mixin
from authlib.integrations.base_client.async_openid import AsyncOpenIDMixin
from authlib.integrations.httpx_client import AsyncOAuth2Client as AsyncHttpxOAuth2Client
from authlib.oauth2.rfc7523 import ClientSecretJWT
from jmespath.exceptions import JMESPathError, ParseError

from phoenix.config import (
    CLIENT_ASSERTION_JWT_AUTH_METHOD,
    AssignableUserRoleName,
    OAuth2ClientConfig,
)

logger = logging.getLogger(__name__)

_MAX_CLIENT_ASSERTION_BYTES = 64 * 1024
"""Generous for a JWT; small enough that a wrong path cannot exhaust the process."""

_ASSERTION_OPEN_FLAGS = os.O_RDONLY | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0)
"""Each flag is present on only one platform, so both are optional.

O_NONBLOCK is POSIX-only and naming it directly is an AttributeError on Windows — which
`except OSError` would not catch, turning a login into a 500. O_BINARY is Windows-only and
suppresses the newline translation that would corrupt an assertion there.
"""

# Pre-compiled default JMESPath for email extraction (standard OIDC "email" claim)
DEFAULT_EMAIL_PATH = jmespath.compile("email")


def search_claim_path(
    compiled: jmespath.parser.ParsedResult,
    claims: dict[str, Any],
    attribute_name: str,
) -> Any:
    """Evaluate a compiled JMESPath expression against claims, tolerating evaluation errors.

    A syntactically valid expression can still raise at evaluation time. The common case is a
    type mismatch when a claim is absent or has an unexpected shape: ``contains(groups[*], 'x')``
    raises JMESPathTypeError when the ``groups`` claim is missing, because ``groups[*]`` projects
    to null and ``contains`` rejects a null subject. Other evaluation-time failures are
    config-shaped rather than claim-shaped — most notably a typo'd function name, which raises
    UnknownFunctionError only at evaluation (function names are not resolved at compile time, so
    such expressions pass the startup validation in ``_compile_jmespath_expression``).

    All of these are caught here: rather than 500-ing the login, the claim is treated as None so
    the caller falls back (fetch UserInfo, or apply the default/strict role behavior). A warning is
    logged so an operator can spot a silently degrading role/group mapping (e.g. SSO users landing
    as VIEWER instead of ADMIN) that previously surfaced as a loud login failure.
    """
    try:
        return compiled.search(claims)
    except JMESPathError as e:
        logger.warning(
            "JMESPath expression for %s could not be evaluated against the current "
            "claims (%s); treating the claim as absent. If this is unexpected, the "
            "configured expression or the claim shape may be misconfigured.",
            attribute_name,
            type(e).__name__,
        )
        return None


@dataclass(frozen=True, repr=False)
class AssertionFile:
    """The client assertion's location, carrying whether it may be repeated in messages.

    This exists to keep a privilege boundary, not to phrase messages nicely.
    CLIENT_ASSERTION_FILE_ENV_VAR lets provider config name any environment variable in the process,
    so an indirect path is a value the config selected but did not write. Repeating it anywhere
    an operator can read converts rights over the non-secret provider config into a read of any
    secret-bearing
    variable — an escalation wherever those privileges differ, as they do for a Kubernetes
    ConfigMap versus a Secret. An indirect path is therefore named by its source and never
    echoed. A direct path was typed into the config verbatim, so repeating it discloses
    nothing and is the useful half of a missing-file message.

    Both __str__ and __repr__ redact, because repr is what tracebacks, debuggers and structured
    loggers reach for and is the likelier disclosure route of the two. Filesystem calls take the
    real path through __fspath__, so the safe form is what every message gets without any call
    site opting in — which is the point: the redaction cannot be forgotten at a site added later.
    """

    path: Path
    variable: Optional[str] = None

    def __fspath__(self) -> str:
        return str(self.path)

    def __str__(self) -> str:
        return f"named by {self.variable}" if self.variable else str(self.path)

    def __repr__(self) -> str:
        # The generated repr would print the path regardless of __str__, and repr is what
        # tracebacks, debuggers and structured loggers reach for.
        return f"{type(self).__name__}({self})"


class ClientAssertionJWT(ClientSecretJWT):  # type:ignore[misc]
    """Client authentication with a platform-minted JWT (RFC 7523 §2.2).

    Unlike `private_key_jwt`, the assertion is not signed here: the platform writes it to the
    file (Azure Workload Identity webhook, SPIFFE, and similar all project a Kubernetes
    service account token this way) and Phoenix relays it verbatim. Which is why the file is
    an AssertionFile rather than a Path — see there for what may be said about it.

    Registered as the auth method instance rather than applied per call site, so authlib
    attaches the assertion to token endpoint requests — fetch, refresh, introspect — on its
    own. Revocation is selected by a separate `revocation_endpoint_auth_method`, which
    add_client sets to the same instance.
    """

    name = CLIENT_ASSERTION_JWT_AUTH_METHOD

    def __init__(self, assertion_file: AssertionFile) -> None:
        super().__init__()
        self._assertion_file = assertion_file

    def _cause(self, error: Exception) -> Optional[Exception]:
        """Drop the cause when it would carry an indirect path a traceback would print.

        OSError keeps the filename and UnicodeDecodeError keeps the offending bytes, so
        chaining hands a traceback logger what the message withheld. A direct path may be
        chained normally, since it is already in the operator's own config.
        """
        return None if self._assertion_file.variable else error

    def sign(self, auth: Any, token_endpoint: str) -> str:
        # Re-read per request, because the platform rotates the token — Kubernetes by
        # swapping the symlink the configured path resolves through, which also means the
        # path can point somewhere new between any two calls. Hence one open and an fstat on
        # the descriptor rather than a stat followed by a separate open: the latter leaves a
        # window in which the target changes after being checked. O_NONBLOCK keeps a FIFO
        # from blocking on open, and the fstat rejects anything not a regular file — a FIFO
        # waits for a writer and a character device never reaches EOF, either of which would
        # stall the event loop, since this read is synchronous inside the async auth flow.
        try:
            fd = os.open(self._assertion_file, _ASSERTION_OPEN_FLAGS)
        except OSError as e:
            # OAuthError is the only failure the login route translates into a redirect;
            # anything else surfaces as a 500. strerror rather than the exception: OSError
            # embeds the filename, which would reintroduce the value AssertionFile withholds.
            raise OAuthError(
                description=(
                    f"cannot read client assertion file {self._assertion_file}: "
                    f"{e.strerror or type(e).__name__}"
                )
            ) from self._cause(e)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise OAuthError(
                    description=(
                        f"client assertion file is not a regular file: {self._assertion_file}"
                    )
                )
            # Bounded: a regular file can still be arbitrarily large, and the value is copied
            # again by strip() and once more by form encoding. Reading one byte past the limit
            # distinguishes "at the limit" from "over it" without trusting st_size, which
            # pseudo-files misreport. Looped because a regular-file read may legally return
            # fewer bytes than asked before EOF, which a single call would take for the whole
            # assertion — truncating it, or letting an oversized file slip under the limit.
            chunks = []
            remaining = _MAX_CLIENT_ASSERTION_BYTES + 1
            while remaining > 0:
                chunk = os.read(fd, remaining)
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            raw = b"".join(chunks)
        except OSError as e:
            raise OAuthError(
                description=(
                    f"cannot read client assertion file {self._assertion_file}: "
                    f"{e.strerror or type(e).__name__}"
                )
            ) from self._cause(e)
        finally:
            os.close(fd)
        if len(raw) > _MAX_CLIENT_ASSERTION_BYTES:
            raise OAuthError(
                description=(
                    f"client assertion file exceeds {_MAX_CLIENT_ASSERTION_BYTES} bytes: "
                    f"{self._assertion_file}"
                )
            )
        try:
            assertion = raw.decode().strip()
        except UnicodeDecodeError as e:
            # A ValueError, not an OSError, and what a path pointing at a binary produces.
            # Its `object` holds the offending bytes, so it is dropped for an indirect file
            # along with the rest.
            raise OAuthError(
                description=f"cannot decode client assertion file {self._assertion_file}"
            ) from self._cause(e)
        if not assertion:
            # An empty value would be sent as `client_assertion=`, which IDPs reject as a
            # generic invalid_client with nothing pointing back at the file.
            raise OAuthError(description=f"client assertion file is empty: {self._assertion_file}")
        return assertion

    def __call__(
        self, auth: Any, method: str, uri: str, headers: Any, body: Any
    ) -> tuple[str, Any, Any]:
        uri, headers, body = super().__call__(auth, method, uri, headers, body)
        # RFC 7523 §3 lets the server identify the client from the assertion's `sub`, which
        # holds for private_key_jwt but not here: the platform sets `sub` to the workload
        # identity (e.g. system:serviceaccount:<ns>:<sa>), so client_id must be explicit.
        # Appending unconditionally would emit it twice for a caller that already supplied
        # one, which strict endpoints reject as invalid_request. Anything already present must
        # be exactly this client: the body's client_id selects which application the assertion
        # is presented for, so a blank or differing value authenticates as the wrong one where
        # a workload is federated to more than one.
        existing = parse_qs(body or "", keep_blank_values=True).get("client_id")
        if existing is None:
            body = add_params_to_qs(body or "", [("client_id", auth.client_id)])
            if "Content-Length" in headers:
                headers["Content-Length"] = str(len(body))
        elif existing != [auth.client_id]:
            raise OAuthError(
                description="client_id in the token request does not match the configured client"
            )
        return uri, headers, body


class OAuth2Client(AsyncOAuth2Mixin, AsyncOpenIDMixin, BaseApp):  # type:ignore[misc]
    """
    An OAuth2 client class that supports OpenID Connect. Adapted from authlib's
    `StarletteOAuth2App` to be useable without integration with Starlette.

    https://github.com/lepture/authlib/blob/904d66bebd79bf39fb8814353a22bab7d3e092c4/authlib/integrations/starlette_client/apps.py#L58
    """

    client_cls = AsyncHttpxOAuth2Client

    #: Keys BaseApp must not take from server metadata. It merges the discovery document
    #: over client_kwargs, so a provider advertising one of these would replace locally
    #: configured client authentication — a document setting "none" strips the assertion
    #: from the token request entirely. Standard OIDC advertises the plural
    #: token_endpoint_auth_methods_supported, so this only bites on nonstandard fields.
    _METADATA_RESERVED_KEYS = ("token_endpoint_auth_method", "revocation_endpoint_auth_method")

    def _get_oauth_client(self, **metadata: Any) -> Any:
        for key in self._METADATA_RESERVED_KEYS:
            metadata.pop(key, None)
        return super()._get_oauth_client(**metadata)

    def __init__(
        self,
        *args: Any,
        display_name: str,
        allow_sign_up: bool,
        auto_login: bool,
        use_pkce: bool = False,
        groups_attribute_path: Optional[str] = None,
        allowed_groups: Optional[list[str]] = None,
        role_attribute_path: Optional[str] = None,
        role_mapping: Optional[Mapping[str, AssignableUserRoleName]] = None,
        role_attribute_strict: bool = False,
        role_resync: bool = True,
        email_attribute_path: Optional[str] = None,
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

        self._compiled_groups_path = self._compile_jmespath_expression(
            self._groups_attribute_path, "GROUPS_ATTRIBUTE_PATH"
        )

        # Role mapping configuration
        self._role_attribute_path = (
            role_attribute_path.strip()
            if role_attribute_path and role_attribute_path.strip()
            else None
        )
        self._role_mapping = role_mapping
        self._role_attribute_strict = role_attribute_strict
        self._role_resync = role_resync
        self._compiled_role_path = self._compile_jmespath_expression(
            self._role_attribute_path, "ROLE_ATTRIBUTE_PATH"
        )

        # Email extraction configuration
        email_attribute_path = (
            email_attribute_path.strip()
            if email_attribute_path and email_attribute_path.strip()
            else None
        )
        # Compile custom path if configured, otherwise use default
        self._compiled_email_path = (
            self._compile_jmespath_expression(email_attribute_path, "EMAIL_ATTRIBUTE_PATH")
            or DEFAULT_EMAIL_PATH
        )

        super().__init__(framework=None, *args, **kwargs)

    @staticmethod
    def _compile_jmespath_expression(
        path: Optional[str], attribute_name: str
    ) -> Optional[jmespath.parser.ParsedResult]:
        """Validate and compile JMESPath expression at startup for fail-fast behavior."""
        if not path:
            return None

        try:
            return jmespath.compile(path)
        except (JMESPathError, ParseError) as e:
            raise ValueError(
                f"Invalid JMESPath expression in {attribute_name}: '{path}'. Error: {e}. "
                "Hint: Claim keys with special characters (colons, dots, slashes, hyphens) "
                "must be enclosed in double quotes. "
                "Examples: '\"cognito:groups\"', '\"https://myapp.com/groups\"'"
            ) from e

    @cached_property
    def allow_sign_up(self) -> bool:
        return self._allow_sign_up

    @cached_property
    def auto_login(self) -> bool:
        return self._auto_login

    @cached_property
    def display_name(self) -> str:
        return self._display_name

    @cached_property
    def use_pkce(self) -> bool:
        return self._use_pkce

    @cached_property
    def role_resync(self) -> bool:
        """When False, existing users' roles are preserved on login instead of re-synced."""
        return self._role_resync

    @cached_property
    def email_path(self) -> jmespath.parser.ParsedResult:
        """Compiled JMESPath expression for email extraction. Defaults to 'email'."""
        return self._compiled_email_path

    def has_sufficient_claims(self, claims: dict[str, Any]) -> bool:
        """
        Check if the ID token contains all application-required claims.

        OIDC Core §2 mandates that ID tokens contain authentication claims (iss, sub, aud,
        exp, iat), but user profile claims (email, name, groups, roles) are optional and may
        only be available via UserInfo endpoint (§5.4, §5.5). This method determines if we
        need to call UserInfo.

        Application-required claims:
        - email: Required for user identification (extracted via email_attribute_path)
        - groups: Required if group-based access control is configured
        - roles: Required if role mapping is configured

        If any required claim is missing, returns False to trigger UserInfo endpoint call.

        Args:
            claims: Claims from ID token (OIDC Core §3.1.3.3)

        Returns:
            True if all application-required claims are present (UserInfo not needed)
            False if additional claims must be fetched from UserInfo endpoint
        """
        # Check for email claim (required by application)
        # Use configured email_path (defaults to "email" claim)
        email = search_claim_path(self._compiled_email_path, claims, "EMAIL_ATTRIBUTE_PATH")
        if not email or not isinstance(email, str) or not email.strip():
            # Email missing or invalid, need UserInfo
            return False

        # Check for group claims if group-based access control is configured
        if self._compiled_groups_path:
            groups = self._extract_groups_from_claims(claims)
            if len(groups) == 0:
                # Groups required but not present, need UserInfo
                return False

        # Check for role claims if role mapping is configured
        if self._compiled_role_path:
            # Check if role claim EXISTS (not whether it maps successfully)
            # Optimization: If the claim exists but doesn't map, UserInfo won't help
            result = search_claim_path(self._compiled_role_path, claims, "ROLE_ATTRIBUTE_PATH")
            role_value = self._normalize_to_single_string(result)
            if not role_value:
                # Role claim missing - UserInfo might have a mappable role
                # (could upgrade from default VIEWER to ADMIN/MEMBER)
                return False
            # Role exists - UserInfo won't help even if role doesn't map
            # (UserInfo will have the same unmappable role)

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

        result = search_claim_path(self._compiled_groups_path, claims, "GROUPS_ATTRIBUTE_PATH")
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

    def extract_and_map_role(self, user_claims: dict[str, Any]) -> Optional[AssignableUserRoleName]:
        """
        Extract and map user role from OIDC claims.

        This method extracts the role claim using the configured JMESPath expression,
        optionally applies role mapping to translate IDP role values to Phoenix roles,
        and handles missing/invalid roles based on the strict mode setting.

        Role Mapping Flow:
        1. Extract role claim using ROLE_ATTRIBUTE_PATH (JMESPath)
           - Supports simple paths: "role", "user.org.role"
           - Supports conditional logic: "contains(groups[*], 'admin') && 'ADMIN' || 'VIEWER'"
        2. Apply ROLE_MAPPING (if configured) to translate IDP role → Phoenix role
           - If ROLE_MAPPING not set, use extracted value directly if valid (ADMIN/MEMBER/VIEWER)
           - This allows JMESPath expressions to return Phoenix roles directly
        3. Validate Phoenix role (ADMIN, MEMBER, VIEWER - SYSTEM excluded for OAuth)
        4. Handle missing/invalid roles:
           - strict=True: Raise PermissionError (deny access)
           - strict=False: Return "VIEWER" (default, least privilege)

        IMPORTANT: Backward Compatibility
        - If ROLE_ATTRIBUTE_PATH is NOT configured, returns None
        - This preserves existing users' roles (no unwanted downgrades)
        - Caller should only apply "VIEWER" default for NEW users

        Args:
            user_claims: Claims from the OIDC ID token or userinfo endpoint

        Returns:
            Phoenix role name (ADMIN, MEMBER, or VIEWER), or None if role attribute
            path is not configured (to preserve existing user roles)

        Raises:
            PermissionError: If strict mode is enabled and role cannot be determined
        """
        # If no role mapping configured, return None to preserve existing user roles
        if not self._compiled_role_path:
            return None

        # Extract role from claims
        result = search_claim_path(self._compiled_role_path, user_claims, "ROLE_ATTRIBUTE_PATH")
        role_value = self._normalize_to_single_string(result)

        # If role claim is missing or empty
        if not role_value:
            if self._role_attribute_strict:
                raise PermissionError(
                    f"Access denied: Role claim not found in user claims. "
                    f"Role attribute path '{self._role_attribute_path}' is configured with "
                    f"strict mode enabled."
                )
            return "VIEWER"  # Non-strict: default to least privilege

        # Apply role mapping if configured
        if self._role_mapping:
            mapped_role = self._role_mapping.get(role_value)
            if not mapped_role:
                # Role value doesn't match any mapping
                if self._role_attribute_strict:
                    raise PermissionError(
                        f"Access denied: Role '{role_value}' is not mapped to a Phoenix role. "
                        f"Role mapping is configured with strict mode enabled."
                    )
                return "VIEWER"  # Non-strict: default to least privilege
            return mapped_role

        # No role mapping configured, but role path exists
        # Try to use the raw role value directly if it's a valid Phoenix role
        # Note: SYSTEM is excluded from valid roles for OIDC (validated at config parsing)
        role_upper = role_value.upper()
        if role_upper in get_args(AssignableUserRoleName):
            return role_upper  # type: ignore[return-value]

        # Role value is not a valid Phoenix role
        if self._role_attribute_strict:
            raise PermissionError(
                f"Access denied: Role '{role_value}' is not a valid Phoenix role "
                f"(expected ADMIN, MEMBER, or VIEWER). Strict mode is enabled."
            )
        return "VIEWER"  # Non-strict: default to least privilege

    @staticmethod
    def _normalize_to_single_string(value: Any) -> Optional[str]:
        """
        Normalize a JMESPath result to a single string value.

        Handles common OIDC claim formats for single-value fields like role.
        If the result is a list, takes the first element.

        Args:
            value: Result from JMESPath query

        Returns:
            String value or None if value cannot be normalized
        """
        if value is None:
            return None

        if isinstance(value, str):
            return value.strip() or None

        if isinstance(value, (int, float, bool)):
            return str(value)

        if isinstance(value, list) and len(value) > 0:
            first = value[0]
            if isinstance(first, str):
                return first.strip() or None
            if isinstance(first, (int, float, bool)):
                return str(first)

        return None


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
        # scope: RFC 6749 §3.3 (space-delimited list of scopes)
        # http2: offers "h2" via TLS ALPN alongside "http/1.1" — negotiated, not
        # forced, so HTTP/1.1-only IDPs are unaffected (needed for IDPs behind
        # proxies requiring end-to-end HTTP/2, e.g. ZITADEL)
        client_kwargs = {"scope": config.scopes, "http2": True}

        if config.token_endpoint_auth_method == CLIENT_ASSERTION_JWT_AUTH_METHOD:
            # authlib accepts an auth method instance here, not just one of its built-in
            # names (authlib >=0.15).
            assert config.client_assertion_file is not None  # enforced by OAuth2ClientConfig
            assertion_file = AssertionFile(
                path=Path(config.client_assertion_file),
                variable=config.client_assertion_file_env_var,
            )
            if not assertion_file.path.is_file():
                # Warn rather than raise: the file is written by the platform, not by the
                # operator, so it can legitimately appear after startup (an init or sidecar
                # container that mints it). Failing here would take the whole server down —
                # including other IDPs and password login — over one provider's mount. The
                # login route reports the missing file per attempt.
                logger.warning(
                    "OAuth2 IDP %s: client assertion file %s does not exist; logins via this "
                    "provider will fail until it appears. On AKS it is projected by the Azure "
                    "Workload Identity webhook, which requires the pod label "
                    "azure.workload.identity/use=true.",
                    config.idp_name,
                    assertion_file,
                )
            auth_method = ClientAssertionJWT(assertion_file)
            client_kwargs["token_endpoint_auth_method"] = auth_method
            # Revocation is selected separately and would otherwise fall back to "none",
            # since there is no client secret to imply a method.
            client_kwargs["revocation_endpoint_auth_method"] = auth_method
        elif config.token_endpoint_auth_method:
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
            role_attribute_path=config.role_attribute_path,
            role_mapping=config.role_mapping,
            role_attribute_strict=config.role_attribute_strict,
            role_resync=config.role_resync,
            email_attribute_path=config.email_attribute_path,
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
