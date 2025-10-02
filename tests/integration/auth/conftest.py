from __future__ import annotations

from pathlib import Path
from secrets import token_hex
from typing import Iterator, Mapping

import pytest
from smtpdfix.certs import Cert, _generate_certs

from .._helpers import (
    _AppInfo,
    _ExistingSpan,
    _insert_spans,
    _OIDCServer,
    _server,
)


@pytest.fixture(scope="package")
def _env_oauth2_standard(
    _oidc_server_standard: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OAuth2/OIDC environment variables (confidential client)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_CLIENT_ID".upper(): _oidc_server_standard.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_CLIENT_SECRET".upper(): _oidc_server_standard.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_CLIENT_ID".upper(): _oidc_server_standard.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_CLIENT_SECRET".upper(): _oidc_server_standard.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_ALLOW_SIGN_UP".upper(): "false",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_public(
    _oidc_server_pkce_public: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 environment variables for public client (no client_secret)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_CLIENT_ID".upper(): _oidc_server_pkce_public.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_public.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_confidential(
    _oidc_server_pkce_confidential: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 environment variables for confidential client (defense-in-depth)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_CLIENT_ID".upper(): _oidc_server_pkce_confidential.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_CLIENT_SECRET".upper(): _oidc_server_pkce_confidential.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_confidential.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_USE_PKCE".upper(): "true",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_groups_granted(
    _oidc_server_pkce_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 with group access control - user HAS matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_CLIENT_ID".upper(): _oidc_server_pkce_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_ALLOWED_GROUPS".upper(): "engineering,admin",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_groups_denied(
    _oidc_server_pkce_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 with group access control - user does NOT have matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_CLIENT_ID".upper(): _oidc_server_pkce_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_ALLOWED_GROUPS".upper(): "admin,sales",
    }


@pytest.fixture(scope="package")
def _env_oauth2_standard_groups_granted(
    _oidc_server_standard_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OIDC with group access control - user HAS matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_CLIENT_ID".upper(): _oidc_server_standard_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_CLIENT_SECRET".upper(): _oidc_server_standard_with_groups.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_ALLOWED_GROUPS".upper(): "engineering,admin",
    }


@pytest.fixture(scope="package")
def _env_oauth2_standard_groups_denied(
    _oidc_server_standard_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OIDC with group access control - user does NOT have matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_CLIENT_ID".upper(): _oidc_server_standard_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_CLIENT_SECRET".upper(): _oidc_server_standard_with_groups.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_ALLOWED_GROUPS".upper(): "admin,sales",
    }


@pytest.fixture(scope="package")
def _env_oauth2(
    _env_oauth2_standard: dict[str, str],
    _env_oauth2_pkce_public: dict[str, str],
    _env_oauth2_pkce_confidential: dict[str, str],
    _env_oauth2_pkce_groups_granted: dict[str, str],
    _env_oauth2_pkce_groups_denied: dict[str, str],
    _env_oauth2_standard_groups_granted: dict[str, str],
    _env_oauth2_standard_groups_denied: dict[str, str],
) -> dict[str, str]:
    """Combine all OAuth2 environment configurations for testing."""
    return {
        **_env_oauth2_standard,
        **_env_oauth2_pkce_public,
        **_env_oauth2_pkce_confidential,
        **_env_oauth2_pkce_groups_granted,
        **_env_oauth2_pkce_groups_denied,
        **_env_oauth2_standard_groups_granted,
        **_env_oauth2_standard_groups_denied,
    }


@pytest.fixture(scope="package")
def _env(
    _env_auth: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_oauth2: Mapping[str, str],
    _env_ports: Mapping[str, str],
    _env_smtp: Mapping[str, str],
    _env_tls: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_tls,
        **_env_ports,
        **_env_database,
        **_env_auth,
        **_env_smtp,
        **_env_oauth2,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


@pytest.fixture(scope="package")
def _env_tls(
    _tls_certs_for_server: Cert,
    _tls_certs_for_client: Cert,
) -> dict[str, str]:
    """Configure TLS environment variables for testing.

    This fixture sets up the necessary environment variables for TLS configuration
    in the Phoenix server. It encrypts the server's private key with a random password
    and configures both server and client certificates for mutual TLS authentication.

    The fixture is automatically used in all tests within its scope and patches
    the environment variables temporarily during test execution.

    Args:
        _tls_certs_server: Server TLS certificates fixture
        _tls_certs_client: Client TLS certificates fixture

    Yields:
        None: The fixture yields control back to the test after setting up the environment
    """
    key_file_password = token_hex(16)
    key_file = _encrypt_private_key(_tls_certs_for_server.key[0], key_file_password)
    return {
        "PHOENIX_TLS_ENABLED": "true",
        "PHOENIX_TLS_CERT_FILE": str(_tls_certs_for_server.cert.resolve()),
        "PHOENIX_TLS_KEY_FILE": str(key_file.resolve()),
        "PHOENIX_TLS_KEY_FILE_PASSWORD": key_file_password,
        "PHOENIX_TLS_CA_FILE": str(_tls_certs_for_client.cert.resolve()),
        "PHOENIX_TLS_VERIFY_CLIENT": "true",
    }


@pytest.fixture(scope="package")
def _tls_certs_for_server(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp(f"certs_for_server_{token_hex(8)}")
    return _generate_certs(path, separate_key=True)


@pytest.fixture(scope="package")
def _tls_certs_for_client(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp(f"certs_for_client_{token_hex(8)}")
    return _generate_certs(path, separate_key=False)


@pytest.fixture(scope="package")
def _oidc_server_standard(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """Standard OAuth2/OIDC server (confidential client with client_secret)."""
    with _OIDCServer(port=next(_ports), use_pkce=False) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_public(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server for public clients (no client_secret)."""
    with _OIDCServer(port=next(_ports), use_pkce=True) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_confidential(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server for confidential clients (defense-in-depth)."""
    with _OIDCServer(port=next(_ports), use_pkce=True) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_with_groups(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server with group claims for access control testing."""
    with _OIDCServer(
        port=next(_ports), use_pkce=True, groups=["engineering", "operations"]
    ) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_standard_with_groups(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """Standard OIDC server with group claims for access control testing."""
    with _OIDCServer(
        port=next(_ports), use_pkce=False, groups=["engineering", "operations"]
    ) as server:
        yield server


# Backward compatibility alias
@pytest.fixture(scope="package")
def _oidc_server(
    _oidc_server_standard: _OIDCServer,
) -> _OIDCServer:
    """Alias for backward compatibility with existing tests."""
    return _oidc_server_standard


def _encrypt_private_key(key_path: Path, password: str) -> Path:
    """
    Encrypt an existing private key file with a password and save to a new file.

    Args:
        key_path: Path to the private key file (PEM format)
        password: Password to encrypt the key with

    Returns:
        Path: Path to the new encrypted key file
    """
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    # Create path for encrypted file
    encrypted_path = key_path.with_name(f"{key_path.stem}_encrypted{key_path.suffix}")

    # Read the unencrypted private key
    with open(key_path, "rb") as f:
        private_key_data = f.read()

    # Load the private key (it's currently unencrypted)
    private_key = load_pem_private_key(
        private_key_data,
        password=None,  # The key is not encrypted yet
        backend=default_backend(),
    )

    # Convert password to bytes
    password_bytes = password.encode()

    # Encrypt the private key
    encrypted_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,  # Match the original format
        encryption_algorithm=serialization.BestAvailableEncryption(password_bytes),
    )

    # Write the encrypted key to the new file
    with open(encrypted_path, "wb") as f:
        f.write(encrypted_pem)

    return encrypted_path


@pytest.fixture(scope="package")
def _existing_spans(
    _app: _AppInfo,
) -> tuple[_ExistingSpan, ...]:
    return _insert_spans(_app, 10)
