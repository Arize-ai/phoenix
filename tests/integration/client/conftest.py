import asyncio
import os
from collections.abc import Iterator
from contextlib import ExitStack
from secrets import token_hex
from typing import Any, Optional
from unittest import mock

import pytest
from faker import Faker
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id
from phoenix.config import (
    get_env_smtp_hostname,
    get_env_smtp_password,
    get_env_smtp_port,
    get_env_smtp_username,
)
from smtpdfix import AuthController, Config, SMTPDFix
from smtpdfix.certs import Cert, _generate_certs
from typing_extensions import TypeAlias

from .._helpers import _AdminSecret, _get, _gql, _grpc_span_exporter, _server, _start_span


@pytest.fixture(scope="package")
def _admin_secret() -> _AdminSecret:
    return _AdminSecret(token_hex(16))


@pytest.fixture(scope="package")
def _app(
    _ports: Iterator[int],
    _env_phoenix_sql_database_url: Any,
    _admin_secret: _AdminSecret,
    _fake: Faker,
) -> Iterator[None]:
    values = (
        ("PHOENIX_ENABLE_AUTH", "true"),
        ("PHOENIX_DISABLE_RATE_LIMIT", "true"),
        ("PHOENIX_SECRET", token_hex(16)),
        ("PHOENIX_ADMIN_SECRET", str(_admin_secret)),
        ("PHOENIX_SMTP_HOSTNAME", "127.0.0.1"),
        ("PHOENIX_SMTP_PORT", str(next(_ports))),
        ("PHOENIX_SMTP_USERNAME", "test"),
        ("PHOENIX_SMTP_PASSWORD", "test"),
        ("PHOENIX_SMTP_MAIL_FROM", _fake.email()),
        ("PHOENIX_SMTP_VALIDATE_CERTS", "false"),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield


@pytest.fixture(scope="package")
def _tls_certs_server(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp("certs_server")
    return _generate_certs(path, separate_key=True)


@pytest.fixture
def _smtpd(
    _app: Any,
    _tls_certs_server: Cert,
) -> Iterator[AuthController]:
    os.environ["SMTPD_SSL_CERTIFICATE_FILE"] = str(_tls_certs_server.cert.resolve())  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
    os.environ["SMTPD_SSL_KEY_FILE"] = str(_tls_certs_server.key[0].resolve())  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]
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


SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


@pytest.fixture(autouse=True, scope="package")
def _span_ids(
    _app: Any,
    _admin_secret: _AdminSecret,
) -> tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]]:
    memory = InMemorySpanExporter()
    for _ in range(2):
        _start_span(project_name="default", exporter=memory).end()
    assert (spans := memory.get_finished_spans())
    headers = {"authorization": f"Bearer {_admin_secret}"}
    assert _grpc_span_exporter(headers=headers).export(spans) is SpanExportResult.SUCCESS
    span1, span2 = spans
    assert (sc1 := span1.get_span_context())  # type: ignore[no-untyped-call]
    span_id1 = format_span_id(sc1.span_id)
    assert (sc2 := span2.get_span_context())  # type: ignore[no-untyped-call]
    span_id2 = format_span_id(sc2.span_id)

    def query_fn() -> Optional[tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]]]:
        res, _ = _gql(_admin_secret, query=QUERY, operation_name="GetSpanIds")
        gids = {e["node"]["spanId"]: e["node"]["id"] for e in res["data"]["node"]["spans"]["edges"]}
        if span_id1 in gids and span_id2 in gids:
            return (span_id1, gids[span_id1]), (span_id2, gids[span_id2])
        return None

    # Use more retries and longer timeouts for CI environments, especially with PostgreSQL
    is_ci = os.environ.get("CI") == "true"
    is_postgresql = os.environ.get("CI_TEST_DB_BACKEND") == "postgresql"

    if is_ci and is_postgresql:
        # CI with PostgreSQL needs more time
        retries = 120  # Double the retries
        max_wait_time = 2.0  # Longer max wait time
    else:
        # Default values for local testing
        retries = 60
        max_wait_time = 1.0

    return asyncio.run(
        _get(query_fn, error_msg="spans not found", retries=retries, max_wait_time=max_wait_time)
    )


QUERY = """
query GetSpanIds {
  node(id: "UHJvamVjdDox") {
    ... on Project {
      spans {
        edges {
          node {
            id
            spanId
          }
        }
      }
    }
  }
}
"""
