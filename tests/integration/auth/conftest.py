from __future__ import annotations

import os
from contextlib import ExitStack
from pathlib import Path
from secrets import token_hex
from typing import Any, Iterator
from unittest import mock

import pytest
from faker import Faker
from opentelemetry.sdk.environment_variables import (
    OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE,
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE,
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY,
)
from phoenix.auth import DEFAULT_SECRET_LENGTH
from phoenix.config import (
    ENV_PHOENIX_ADMIN_SECRET,
    ENV_PHOENIX_CSRF_TRUSTED_ORIGINS,
    ENV_PHOENIX_DISABLE_RATE_LIMIT,
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
    ENV_PHOENIX_SMTP_HOSTNAME,
    ENV_PHOENIX_SMTP_MAIL_FROM,
    ENV_PHOENIX_SMTP_PASSWORD,
    ENV_PHOENIX_SMTP_PORT,
    ENV_PHOENIX_SMTP_USERNAME,
    ENV_PHOENIX_SMTP_VALIDATE_CERTS,
    ENV_PHOENIX_TLS_CA_FILE,
    ENV_PHOENIX_TLS_CERT_FILE,
    ENV_PHOENIX_TLS_ENABLED,
    ENV_PHOENIX_TLS_KEY_FILE,
    ENV_PHOENIX_TLS_KEY_FILE_PASSWORD,
    ENV_PHOENIX_TLS_VERIFY_CLIENT,
    get_env_smtp_hostname,
    get_env_smtp_password,
    get_env_smtp_port,
    get_env_smtp_username,
)
from smtpdfix import AuthController, Config, SMTPDFix
from smtpdfix.certs import Cert, _generate_certs

from .._helpers import _OIDCServer, _Secret, _server


@pytest.fixture(scope="module")
def _secret(
    _env_phoenix_sql_database_url: Any,
) -> _Secret:
    return token_hex(DEFAULT_SECRET_LENGTH)


@pytest.fixture(autouse=True, scope="module")
def _app(
    _ports: Iterator[int],
    _secret: _Secret,
    _env_phoenix_sql_database_url: Any,
    _env_tls: Any,
    _oidc_server: _OIDCServer,
    _fake: Faker,
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_DISABLE_RATE_LIMIT, "true"),
        (ENV_PHOENIX_SECRET, _secret),
        (ENV_PHOENIX_SMTP_HOSTNAME, "127.0.0.1"),
        (ENV_PHOENIX_SMTP_PORT, str(next(_ports))),
        (ENV_PHOENIX_SMTP_USERNAME, "test"),
        (ENV_PHOENIX_SMTP_PASSWORD, "test"),
        (ENV_PHOENIX_SMTP_MAIL_FROM, _fake.email()),
        (ENV_PHOENIX_SMTP_VALIDATE_CERTS, "false"),
        (ENV_PHOENIX_CSRF_TRUSTED_ORIGINS, ",http://localhost,"),
        (ENV_PHOENIX_ADMIN_SECRET, token_hex(16)),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_CLIENT_ID".upper(),
            _oidc_server.client_id,
        ),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_CLIENT_SECRET".upper(),
            _oidc_server.client_secret,
        ),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_OIDC_CONFIG_URL".upper(),
            f"{_oidc_server.base_url}/.well-known/openid-configuration",
        ),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_CLIENT_ID".upper(),
            _oidc_server.client_id,
        ),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_CLIENT_SECRET".upper(),
            _oidc_server.client_secret,
        ),
        (
            f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_OIDC_CONFIG_URL".upper(),
            f"{_oidc_server.base_url}/.well-known/openid-configuration",
        ),
        (f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_ALLOW_SIGN_UP".upper(), "false"),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield


@pytest.fixture(autouse=True, scope="module")
def _env_tls(
    _tls_certs_server: Cert,
    _tls_certs_client: Cert,
) -> Iterator[None]:
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
    """  # noqa: E501
    key_file_password = token_hex(16)
    key_file = _encrypt_private_key(_tls_certs_server.key[0], key_file_password)
    values = (
        (ENV_PHOENIX_TLS_ENABLED, "true"),
        (ENV_PHOENIX_TLS_CERT_FILE, str(_tls_certs_server.cert.resolve())),
        (ENV_PHOENIX_TLS_KEY_FILE, str(key_file.resolve())),
        (ENV_PHOENIX_TLS_KEY_FILE_PASSWORD, key_file_password),
        (ENV_PHOENIX_TLS_CA_FILE, str(_tls_certs_client.cert.resolve())),
        (ENV_PHOENIX_TLS_VERIFY_CLIENT, "true"),
        (OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE, str(_tls_certs_server.cert.resolve())),
        (OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE, str(_tls_certs_client.cert.resolve())),
        (OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY, str(_tls_certs_client.cert.resolve())),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        yield


@pytest.fixture(scope="module")
def _tls_certs_server(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp("certs_server")
    return _generate_certs(path, separate_key=True)


@pytest.fixture(scope="module")
def _tls_certs_client(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp("certs_client")
    return _generate_certs(path, separate_key=False)


@pytest.fixture(scope="module")
def _smtpd(
    _app: Any,
    _tls_certs_server: Cert,
) -> Iterator[AuthController]:
    os.environ["SMTPD_SSL_CERTIFICATE_FILE"] = str(_tls_certs_server.cert.resolve())
    os.environ["SMTPD_SSL_KEY_FILE"] = str(_tls_certs_server.key[0].resolve())
    config = Config()
    config.login_username = get_env_smtp_username()
    config.login_password = get_env_smtp_password()
    config.use_starttls = True
    with SMTPDFix(
        hostname=get_env_smtp_hostname(),
        port=get_env_smtp_port(),
        config=config,
    ) as controller:
        yield controller


@pytest.fixture(scope="module")
def _oidc_server(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    with _OIDCServer(port=next(_ports)) as server:
        yield server


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
