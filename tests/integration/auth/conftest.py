from __future__ import annotations

import asyncio
from pathlib import Path
from secrets import token_hex
from typing import Iterator, Mapping, Optional

import pytest
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id
from smtpdfix.certs import Cert, _generate_certs
from typing_extensions import TypeAlias

from .._helpers import _AppInfo, _get, _gql, _grpc_span_exporter, _OIDCServer, _server, _start_span


@pytest.fixture(scope="package")
def _env_oauth2(
    _oidc_server: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2/OIDC environment variables for testing."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server}_CLIENT_ID".upper(): _oidc_server.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server}_CLIENT_SECRET".upper(): _oidc_server.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server}_OIDC_CONFIG_URL".upper(): f"{_oidc_server.base_url}/.well-known/openid-configuration",  # noqa: E501
        f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_CLIENT_ID".upper(): _oidc_server.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_CLIENT_SECRET".upper(): _oidc_server.client_secret,  # noqa: E501
        f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_OIDC_CONFIG_URL".upper(): f"{_oidc_server.base_url}/.well-known/openid-configuration",  # noqa: E501
        f"PHOENIX_OAUTH2_{_oidc_server}_NO_SIGN_UP_ALLOW_SIGN_UP".upper(): "false",
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
    """  # noqa: E501
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


SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str
TraceId: TypeAlias = str
TraceGlobalId: TypeAlias = str


@pytest.fixture(autouse=True, scope="package")
def _span_ids(
    _app: _AppInfo,
) -> tuple[
    tuple[SpanId, SpanGlobalId, TraceId, TraceGlobalId],
    tuple[SpanId, SpanGlobalId, TraceId, TraceGlobalId],
]:
    memory = InMemorySpanExporter()
    for _ in range(2):
        _start_span(project_name="default", exporter=memory).end()
    assert (spans := memory.get_finished_spans())
    headers = {"authorization": f"Bearer {_app.admin_secret}"}
    assert _grpc_span_exporter(_app, headers=headers).export(spans) is SpanExportResult.SUCCESS
    span1, span2 = spans
    assert (sc1 := span1.get_span_context())  # type: ignore[no-untyped-call]
    span_id1 = format_span_id(sc1.span_id)
    assert (sc2 := span2.get_span_context())  # type: ignore[no-untyped-call]
    span_id2 = format_span_id(sc2.span_id)
    span_ids = [span_id1, span_id2]

    def query_fn() -> (
        Optional[
            tuple[
                tuple[SpanId, SpanGlobalId, TraceId, TraceGlobalId],
                tuple[SpanId, SpanGlobalId, TraceId, TraceGlobalId],
            ]
        ]
    ):
        res, _ = _gql(
            _app,
            _app.admin_secret,
            query=QUERY,
            operation_name="GetSpanIds",
            variables={"filterCondition": f"span_id in {span_ids}"},
        )
        span_gids: dict[SpanId, tuple[SpanGlobalId, TraceId, TraceGlobalId]] = {
            span["node"]["spanId"]: (
                span["node"]["id"],
                span["node"]["trace"]["traceId"],
                span["node"]["trace"]["id"],
            )
            for span in res["data"]["node"]["spans"]["edges"]
        }
        if span_id1 in span_gids and span_id2 in span_gids:
            return (span_id1, *span_gids[span_id1]), (span_id2, *span_gids[span_id2])
        return None

    return asyncio.run(_get(query_fn, error_msg="spans not found"))


QUERY = """
query GetSpanIds ($filterCondition: String) {
  node(id: "UHJvamVjdDox") {
    ... on Project {
      spans (filterCondition: $filterCondition) {
        edges {
          node {
            id
            spanId
            trace {
              id
              traceId
            }
          }
        }
      }
    }
  }
}
"""
