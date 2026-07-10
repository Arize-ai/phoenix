"""OAuth2 authorization-server helpers for issuing Phoenix bearer tokens to clients."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Literal, cast
from urllib.parse import SplitResult, urlsplit, urlunsplit

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from phoenix.config import ENV_PHOENIX_ROOT_URL, get_env_host_root_path, get_env_root_url
from phoenix.db import models

_PKCE_VERIFIER_PATTERN = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")
_PRIVATE_USE_SCHEME_PATTERN = re.compile(r"^[a-z][a-z0-9+.-]*$")
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})


class StrEnum(str, Enum):
    """String-valued enum base for Python versions without stdlib StrEnum."""


class OAuth2AuthorizationServerError(ValueError):
    """Raised when an OAuth2 authorization-server helper rejects invalid input."""


class RedirectUriValidationError(OAuth2AuthorizationServerError):
    """Raised when a redirect URI cannot be safely used for an OAuth2 response."""


class ResourceIdentifierError(OAuth2AuthorizationServerError):
    """Raised when a resource identifier is not an absolute URL without query or fragment."""


class RedirectUriKind(StrEnum):
    """Redirect URI delivery mechanisms accepted by the authorization server."""

    LOOPBACK = "loopback"
    PRIVATE_USE_SCHEME = "private_use_scheme"
    HTTPS_REGISTERED = "https_registered"


class RedirectUriDialPosition(StrEnum):
    """Controls which redirect URI delivery mechanisms are enabled for public clients."""

    DISABLED = "disabled"
    LOCAL_ONLY = "local_only"
    ENABLED = "enabled"


@dataclass(frozen=True)
class Loopback:
    """A local HTTP redirect handled by a process listening on the user's machine."""

    uri: str
    host: str
    port: int | None
    path: str
    kind: Literal[RedirectUriKind.LOOPBACK] = RedirectUriKind.LOOPBACK


@dataclass(frozen=True)
class PrivateUseScheme:
    """A non-web redirect routed by the operating system to an installed application."""

    uri: str
    scheme: str
    kind: Literal[RedirectUriKind.PRIVATE_USE_SCHEME] = RedirectUriKind.PRIVATE_USE_SCHEME


@dataclass(frozen=True)
class HttpsRegistered:
    """An HTTPS redirect whose full URI string matches client registration."""

    uri: str
    kind: Literal[RedirectUriKind.HTTPS_REGISTERED] = RedirectUriKind.HTTPS_REGISTERED


RedirectUri = Loopback | PrivateUseScheme | HttpsRegistered

DENIED_PRIVATE_USE_SCHEMES = frozenset(
    {
        "http",
        "https",
        "javascript",
        "data",
        "vbscript",
        "file",
        "blob",
        "about",
        "ws",
        "wss",
    }
)

__all__ = [
    "DENIED_PRIVATE_USE_SCHEMES",
    "HttpsRegistered",
    "Loopback",
    "OAuth2AuthorizationServerError",
    "PrivateUseScheme",
    "RedirectUri",
    "RedirectUriDialPosition",
    "RedirectUriKind",
    "RedirectUriValidationError",
    "ResourceIdentifierError",
    "canonical_resource_identifier",
    "create_code_challenge",
    "get_oauth2_client_by_client_id",
    "granted_scopes_from_request",
    "hash_authorization_code",
    "is_valid_pkce_verifier",
    "public_origin",
    "require_oauth2_client_by_client_id",
    "validate_redirect_uri",
    "validate_state",
    "verify_pkce",
]


def is_valid_pkce_verifier(verifier: str) -> bool:
    """Return whether a PKCE verifier uses the RFC 7636 length and character set."""
    return bool(_PKCE_VERIFIER_PATTERN.fullmatch(verifier))


def create_code_challenge(verifier: str) -> str:
    """Return the S256 PKCE challenge for a verifier."""
    if not is_valid_pkce_verifier(verifier):
        raise OAuth2AuthorizationServerError(
            "PKCE verifier must be 43 to 128 characters using A-Z, a-z, 0-9, '.', '_', '~', or '-'."
        )
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_pkce(verifier: str, challenge: str) -> bool:
    """Return whether a verifier matches an S256 PKCE challenge."""
    if not is_valid_pkce_verifier(verifier):
        return False
    return hmac.compare_digest(create_code_challenge(verifier), challenge)


def hash_authorization_code(code: str) -> str:
    """Return the SHA-256 hex digest stored for an authorization code."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def validate_state(state: str | None) -> str:
    """Return a state value only when it is present and long enough to resist guessing."""
    if state is None or not state or len(state) < 22:
        raise OAuth2AuthorizationServerError("OAuth2 state must be at least 22 characters.")
    return state


def granted_scopes_from_request(scope: str | None) -> tuple[str, ...]:
    """Return the scopes Phoenix grants for an OAuth2 request.

    Phoenix does not yet restrict token capabilities by scope: requested
    scopes are accepted but none are granted, and tokens act with the
    permissions of the user who approved the authorization. The scope
    storage on grants and tokens remains in place so a scope model can be
    introduced without a schema change.
    """
    return ()


def validate_redirect_uri(
    uri: str,
    registered_redirect_uris: list[str],
    dial_position: RedirectUriDialPosition,
) -> RedirectUri:
    """Classify a redirect URI after validating it against client registration."""
    parsed = urlsplit(uri)
    _reject_malformed_uri(parsed)
    scheme = parsed.scheme.lower()

    if scheme == "http":
        return _validate_loopback_redirect(
            uri,
            parsed,
            registered_redirect_uris,
            dial_position,
        )
    if _is_private_use_scheme(scheme):
        return _validate_private_use_scheme_redirect(
            uri,
            parsed,
            scheme,
            registered_redirect_uris,
            dial_position,
        )
    if scheme == "https":
        return _validate_https_registered_redirect(uri, registered_redirect_uris, dial_position)
    raise RedirectUriValidationError("Unsupported redirect URI scheme.")


async def get_oauth2_client_by_client_id(
    session: AsyncSession,
    client_id: str,
) -> models.OAuth2Client | None:
    """Load a registered OAuth2 client by its public client identifier."""
    return cast(
        models.OAuth2Client | None,
        await session.scalar(
            sa.select(models.OAuth2Client).where(models.OAuth2Client.client_id == client_id)
        ),
    )


async def require_oauth2_client_by_client_id(
    session: AsyncSession,
    client_id: str,
) -> models.OAuth2Client:
    """Load a registered OAuth2 client or raise when the identifier is unknown."""
    client = await get_oauth2_client_by_client_id(session, client_id)
    if client is None:
        raise OAuth2AuthorizationServerError("Unknown OAuth2 client.")
    return client


def canonical_resource_identifier(url: str) -> str:
    """Return the canonical identifier for this deployment resource."""
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        raise ResourceIdentifierError("Resource identifier must be an absolute URL.")
    if parsed.query or parsed.fragment:
        raise ResourceIdentifierError("Resource identifier cannot include query or fragment.")
    if parsed.username or parsed.password:
        raise ResourceIdentifierError("Resource identifier cannot include user information.")
    port = _parsed_port(parsed)
    scheme = parsed.scheme.lower()
    host = _parsed_host(parsed)
    path = _path_with_configured_root_path(parsed.path)
    netloc = _netloc(host, port, scheme)
    return urlunsplit((scheme, netloc, path, "", ""))


def public_origin(request: Request) -> str:
    """Return the public base URL clients use as the issuer and resource identifier."""
    if os.getenv(ENV_PHOENIX_ROOT_URL):
        return canonical_resource_identifier(str(get_env_root_url()))
    return canonical_resource_identifier(str(request.base_url))


def _validate_loopback_redirect(
    uri: str,
    parsed: SplitResult,
    registered_redirect_uris: list[str],
    dial_position: RedirectUriDialPosition,
) -> Loopback:
    if dial_position == RedirectUriDialPosition.DISABLED:
        raise RedirectUriValidationError("Loopback redirect URIs are disabled.")
    if parsed.fragment:
        raise RedirectUriValidationError("Loopback redirect URI cannot include a fragment.")
    host = _parsed_host(parsed)
    if host not in _LOOPBACK_HOSTS:
        raise RedirectUriValidationError("Loopback redirect URI must use a loopback host.")
    port = _parsed_port(parsed)
    if not any(
        _loopback_redirect_matches_registration(parsed, registered_uri)
        for registered_uri in registered_redirect_uris
    ):
        raise RedirectUriValidationError("Loopback redirect URI is not registered for this client.")
    return Loopback(uri=uri, host=host, port=port, path=parsed.path or "/")


def _loopback_redirect_matches_registration(
    requested: SplitResult,
    registered_uri: str,
) -> bool:
    registered = urlsplit(registered_uri)
    try:
        _reject_malformed_uri(registered)
        registered_host = _parsed_host(registered)
    except OAuth2AuthorizationServerError:
        return False
    if registered.scheme.lower() != "http" or registered_host not in _LOOPBACK_HOSTS:
        return False
    if registered.fragment:
        return False
    return (
        _parsed_host(requested) == registered_host
        and (requested.path or "/") == (registered.path or "/")
        and requested.query == registered.query
    )


def _validate_private_use_scheme_redirect(
    uri: str,
    parsed: SplitResult,
    scheme: str,
    registered_redirect_uris: list[str],
    dial_position: RedirectUriDialPosition,
) -> PrivateUseScheme:
    if dial_position == RedirectUriDialPosition.DISABLED:
        raise RedirectUriValidationError("Private-use-scheme redirect URIs are disabled.")
    if parsed.fragment:
        raise RedirectUriValidationError(
            "Private-use-scheme redirect URI cannot include a fragment."
        )
    if uri not in registered_redirect_uris:
        raise RedirectUriValidationError(
            "Private-use-scheme redirect URI is not registered for this client."
        )
    return PrivateUseScheme(uri=uri, scheme=scheme)


def _validate_https_registered_redirect(
    uri: str,
    registered_redirect_uris: list[str],
    dial_position: RedirectUriDialPosition,
) -> HttpsRegistered:
    if dial_position != RedirectUriDialPosition.ENABLED:
        raise RedirectUriValidationError("HTTPS redirect URIs are disabled.")
    if uri not in registered_redirect_uris:
        raise RedirectUriValidationError("HTTPS redirect URI is not registered for this client.")
    return HttpsRegistered(uri=uri)


def _reject_malformed_uri(parsed: SplitResult) -> None:
    if not parsed.scheme:
        raise RedirectUriValidationError("Redirect URI must include a scheme.")
    if parsed.scheme.lower() in {"http", "https"} and not parsed.netloc:
        raise RedirectUriValidationError("HTTP redirect URI must include a host.")
    if parsed.username or parsed.password:
        raise RedirectUriValidationError("Redirect URI cannot include user information.")
    _parsed_port(parsed)


def _is_private_use_scheme(scheme: str) -> bool:
    return bool(_PRIVATE_USE_SCHEME_PATTERN.fullmatch(scheme)) and (
        scheme not in DENIED_PRIVATE_USE_SCHEMES
    )


def _parsed_port(parsed: SplitResult) -> int | None:
    try:
        return parsed.port
    except ValueError as error:
        raise OAuth2AuthorizationServerError("URI port is invalid.") from error


def _parsed_host(parsed: SplitResult) -> str:
    if not parsed.hostname:
        raise OAuth2AuthorizationServerError("URI host is required.")
    return parsed.hostname.lower()


def _path_with_configured_root_path(path: str) -> str:
    path = path.rstrip("/")
    root_path = get_env_host_root_path()
    if not root_path:
        return path
    if not path:
        return root_path
    if path == root_path or path.startswith(f"{root_path}/"):
        return path
    return f"{root_path}{path if path.startswith('/') else f'/{path}'}"


def _netloc(host: str, port: int | None, scheme: str) -> str:
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if port is None or (scheme == "https" and port == 443) or (scheme == "http" and port == 80):
        return host
    return f"{host}:{port}"
