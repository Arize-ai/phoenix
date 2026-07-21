import base64
import hashlib

import pytest
from starlette.requests import Request

from phoenix.server.oauth2_authorization_server import (
    DENIED_PRIVATE_USE_SCHEMES,
    HttpsRegistered,
    Loopback,
    OAuth2AuthorizationServerError,
    PrivateUseScheme,
    RedirectUriDialPosition,
    RedirectUriValidationError,
    ResourceIdentifierError,
    canonical_resource_identifier,
    create_code_challenge,
    granted_scopes_from_request,
    hash_authorization_code,
    is_valid_pkce_verifier,
    public_origin,
    validate_redirect_uri,
    validate_state,
    verify_pkce,
)


def test_create_code_challenge_uses_s256_without_padding() -> None:
    verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    expected = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    assert create_code_challenge(verifier) == expected
    assert "=" not in create_code_challenge(verifier)


@pytest.mark.parametrize(
    "verifier",
    [
        "a" * 43,
        "a" * 128,
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",
    ],
)
def test_valid_pkce_verifier_charset_and_length(verifier: str) -> None:
    assert is_valid_pkce_verifier(verifier)


@pytest.mark.parametrize(
    "verifier",
    [
        "a" * 42,
        "a" * 129,
        "a" * 42 + "!",
        "a" * 42 + "=",
    ],
)
def test_invalid_pkce_verifier_charset_and_length(verifier: str) -> None:
    assert not is_valid_pkce_verifier(verifier)
    with pytest.raises(OAuth2AuthorizationServerError):
        create_code_challenge(verifier)


def test_verify_pkce_uses_constant_time_challenge_comparison() -> None:
    verifier = "a" * 43
    challenge = create_code_challenge(verifier)

    assert verify_pkce(verifier, challenge)
    assert not verify_pkce(verifier, f"{challenge}x")
    assert not verify_pkce("short", challenge)


@pytest.mark.parametrize(
    "uri,host,port,path",
    [
        ("http://127.0.0.1:1234/callback", "127.0.0.1", 1234, "/callback"),
        ("http://127.0.0.1:65000/callback/derived", "127.0.0.1", 65000, "/callback/derived"),
        ("http://localhost/", "localhost", None, "/"),
        ("http://[::1]:8080/anything/here", "::1", 8080, "/anything/here"),
    ],
)
def test_loopback_redirect_uri_allows_registered_path_on_any_port(
    uri: str,
    host: str,
    port: int | None,
    path: str,
) -> None:
    registered_uri = f"http://{f'[{host}]' if ':' in host else host}{path}"
    redirect_uri = validate_redirect_uri(
        uri,
        [registered_uri],
        RedirectUriDialPosition.LOCAL_ONLY,
    )

    assert redirect_uri == Loopback(uri=uri, host=host, port=port, path=path)


@pytest.mark.parametrize(
    "uri",
    [
        "http://127.0.0.1:1234/callback#fragment",
        "http://example.com/callback",
    ],
)
def test_loopback_redirect_uri_rejects_fragment_and_non_loopback_host(uri: str) -> None:
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(uri, [uri], RedirectUriDialPosition.LOCAL_ONLY)


def test_loopback_redirect_uri_requires_registered_host_path_and_query() -> None:
    registered_uri = "http://127.0.0.1/callback?channel=stable"

    assert validate_redirect_uri(
        "http://127.0.0.1:49152/callback?channel=stable",
        [registered_uri],
        RedirectUriDialPosition.LOCAL_ONLY,
    )
    for unregistered_uri in (
        "http://localhost:49152/callback?channel=stable",
        "http://127.0.0.1:49152/",
        "http://127.0.0.1:49152/callback?channel=insiders",
    ):
        with pytest.raises(RedirectUriValidationError):
            validate_redirect_uri(
                unregistered_uri,
                [registered_uri],
                RedirectUriDialPosition.LOCAL_ONLY,
            )


@pytest.mark.parametrize(
    "uri,scheme",
    [
        ("cursor://anysphere.cursor-mcp/oauth/callback", "cursor"),
        ("com.example.app:/oauth2redirect", "com.example.app"),
        ("my-app+test://callback", "my-app+test"),
    ],
)
def test_private_use_scheme_redirect_uri(uri: str, scheme: str) -> None:
    redirect_uri = validate_redirect_uri(uri, [uri], RedirectUriDialPosition.LOCAL_ONLY)

    assert redirect_uri == PrivateUseScheme(uri=uri, scheme=scheme)


@pytest.mark.parametrize("scheme", sorted(DENIED_PRIVATE_USE_SCHEMES))
def test_private_use_scheme_redirect_uri_rejects_each_denied_scheme(scheme: str) -> None:
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(f"{scheme}:example", [], RedirectUriDialPosition.LOCAL_ONLY)


@pytest.mark.parametrize(
    "uri",
    [
        "cursor://anysphere.cursor-mcp/oauth/callback#fragment",
        "1cursor://callback",
    ],
)
def test_private_use_scheme_redirect_uri_rejects_fragment_and_bad_scheme(
    uri: str,
) -> None:
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(uri, [uri], RedirectUriDialPosition.LOCAL_ONLY)


def test_private_use_scheme_redirect_uri_requires_exact_registration() -> None:
    registered_uri = "cursor://anysphere.cursor-mcp/oauth/callback"

    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(
            "cursor://other-app/oauth/callback",
            [registered_uri],
            RedirectUriDialPosition.LOCAL_ONLY,
        )


def test_https_redirect_uri_requires_exact_registered_match_and_enabled_dial() -> None:
    uri = "https://client.example.com/oauth/callback"

    redirect_uri = validate_redirect_uri(uri, [uri], RedirectUriDialPosition.ENABLED)

    assert redirect_uri == HttpsRegistered(uri=uri)
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(uri, [uri], RedirectUriDialPosition.LOCAL_ONLY)
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(f"{uri}/extra", [uri], RedirectUriDialPosition.ENABLED)


@pytest.mark.parametrize(
    "uri",
    [
        "http://127.0.0.1/callback",
        "cursor://anysphere.cursor-mcp/oauth/callback",
    ],
)
def test_dynamic_redirect_uris_are_rejected_when_dial_is_disabled(uri: str) -> None:
    with pytest.raises(RedirectUriValidationError):
        validate_redirect_uri(uri, [uri], RedirectUriDialPosition.DISABLED)


@pytest.mark.parametrize("state", [None, "", "a" * 21])
def test_validate_state_rejects_missing_empty_or_short_values(state: str | None) -> None:
    with pytest.raises(OAuth2AuthorizationServerError):
        validate_state(state)


def test_validate_state_accepts_minimum_length_value() -> None:
    state = "a" * 22

    assert validate_state(state) == state


@pytest.mark.parametrize(
    "scope",
    [
        None,
        "",
        "openid email profile unknown",
        "write admin delete_everything",
    ],
)
def test_granted_scopes_from_request_is_lenient(scope: str | None) -> None:
    assert granted_scopes_from_request(scope) == ()


def test_hash_authorization_code_returns_sha256_hex() -> None:
    code = "raw-code-never-stored"

    assert hash_authorization_code(code) == hashlib.sha256(code.encode("utf-8")).hexdigest()


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://phoenix.example.com/", "https://phoenix.example.com"),
        ("https://phoenix.example.com/path/", "https://phoenix.example.com/path"),
        ("https://phoenix.example.com:443/path", "https://phoenix.example.com/path"),
        ("http://phoenix.example.com:80/path", "http://phoenix.example.com/path"),
        ("https://PHOENIX.EXAMPLE.COM/CaseSensitive", "https://phoenix.example.com/CaseSensitive"),
    ],
)
def test_canonical_resource_identifier_normalizes_url(url: str, expected: str) -> None:
    assert canonical_resource_identifier(url) == expected


def test_canonical_resource_identifier_includes_configured_root_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", "/phoenix")

    assert canonical_resource_identifier("https://phoenix.example.com") == (
        "https://phoenix.example.com/phoenix"
    )
    assert canonical_resource_identifier("https://phoenix.example.com/phoenix") == (
        "https://phoenix.example.com/phoenix"
    )
    assert canonical_resource_identifier("https://phoenix.example.com/api") == (
        "https://phoenix.example.com/phoenix/api"
    )


@pytest.mark.parametrize(
    "url",
    [
        "/relative",
        "https://phoenix.example.com?resource=other",
        "https://phoenix.example.com#fragment",
    ],
)
def test_canonical_resource_identifier_rejects_invalid_resource_urls(url: str) -> None:
    with pytest.raises(ResourceIdentifierError):
        canonical_resource_identifier(url)


def test_public_origin_prefers_configured_root_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_ROOT_URL", "https://public.example.com/phoenix")
    monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", "/phoenix")
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "server": ("internal.example.com", 6006),
            "scheme": "http",
            "client": ("127.0.0.1", 12345),
        }
    )

    assert public_origin(request) == "https://public.example.com/phoenix"


def test_public_origin_falls_back_to_request_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PHOENIX_ROOT_URL", raising=False)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "root_path": "/phoenix",
            "headers": [(b"host", b"localhost:6006")],
            "server": ("localhost", 6006),
            "scheme": "http",
            "client": ("127.0.0.1", 12345),
        }
    )

    assert public_origin(request) == "http://localhost:6006/phoenix"
