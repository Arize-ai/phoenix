from collections.abc import Iterator
from secrets import token_bytes, token_hex
from time import sleep
from typing import Any, Optional

import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.trace import SpanContext
from smtpdfix import AuthController

from .._helpers import (
    _AdminSecret,
    _AppInfo,
    _create_api_key,
    _extract_html,
    _extract_password_reset_token,
    _gql,
    _grpc_span_exporter,
    _http_span_exporter,
    _httpx_client,
    _log_in,
    _log_out,
    _PasswordResetToken,
    _server,
)


@pytest.fixture(scope="module")
def _admin_secret() -> _AdminSecret:
    return _AdminSecret(token_hex(16))


@pytest.fixture(scope="module")
def _admin_email() -> str:
    return f"{token_hex(8)}@example.com"


@pytest.fixture(scope="module")
def _env_auth(
    _admin_secret: _AdminSecret,
) -> dict[str, str]:
    """Configure authentication and security environment variables for testing."""
    return {
        "PHOENIX_ENABLE_AUTH": "true",
        "PHOENIX_DISABLE_RATE_LIMIT": "true",
        "PHOENIX_SECRET": token_hex(16),
        "PHOENIX_ADMIN_SECRET": str(_admin_secret),
    }


@pytest.fixture(scope="module")
def _env_admin(
    _admin_email: str,
) -> dict[str, str]:
    """Configure admin environment variables for testing."""
    return {
        "PHOENIX_ADMINS": f"John Doe={_admin_email}",
    }


@pytest.fixture(scope="module")
def _env_database_usage() -> dict[str, str]:
    """
    Configure extremely low disk usage thresholds to test monitoring behavior.

    Key configuration:
    - Database capacity: 0.001 GiB (~1 MB) - tiny to trigger thresholds quickly
    - Email notification threshold: 0.1% - sends alerts at ~1 KB usage
    - Insertion blocking threshold: 0.2% - blocks data inserts at ~2 KB usage

    This setup ensures the monitor will activate during normal test operations,
    allowing us to verify both notification and blocking behaviors.
    """
    return {
        # Set extremely low capacity to trigger thresholds during testing
        "PHOENIX_DATABASE_ALLOCATED_STORAGE_CAPACITY_GIBIBYTES": "0.001",
        # Notification threshold: 0.1% of 0.001 GiB = ~1 KB
        "PHOENIX_DATABASE_USAGE_EMAIL_WARNING_THRESHOLD_PERCENTAGE": "0.1",
        # Blocking threshold: 0.2% of 0.001 GiB = ~2 KB
        "PHOENIX_DATABASE_USAGE_INSERTION_BLOCKING_THRESHOLD_PERCENTAGE": "0.2",
    }


@pytest.fixture(scope="module")
def _env(
    _env_database: dict[str, str],
    _env_ports: dict[str, str],
    _env_auth: dict[str, str],
    _env_smtp: dict[str, str],
    _env_admin: dict[str, str],
    _env_database_usage: dict[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_database,
        **_env_ports,
        **_env_auth,
        **_env_smtp,
        **_env_admin,
        **_env_database_usage,
    }


@pytest.fixture(scope="module")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


class TestDbDiskUsageMonitor:
    def test_email_warning_and_insertion_blocking(
        self,
        _app: _AppInfo,
        _smtpd: AuthController,
        _admin_email: str,
        _admin_secret: _AdminSecret,
    ) -> None:
        """
        Comprehensive test of the database disk usage monitor functionality.

        This test verifies the monitor's behavior when disk usage thresholds are exceeded:

        1. **Email Notification Phase** (0.1% threshold):
           - Automatic email alerts are sent to administrators
           - Email contains proper subject and HTML content
           - System continues to accept all operations

        2. **Insertion Blocking Phase** (0.2% threshold):
           - Data insertion operations are blocked (spans, projects, datasets, etc.)
           - Read operations continue to work normally
           - Authentication operations remain functional
           - System returns appropriate HTTP 503 errors for blocked operations

        3. **Service Continuity Verification**:
           - Authentication flows (login, password reset) still work
           - GraphQL queries and non-insertion mutations work
           - REST API GET endpoints remain available
           - Only data-creation operations are blocked

        The test uses extremely low thresholds (0.001 GiB capacity) to ensure the monitor
        activates during normal test execution, allowing verification of both notification
        and blocking behaviors without requiring large amounts of test data.
        """

        # ========================================================================
        # Wait for and verify email notification is sent
        # ========================================================================
        # The monitor runs asynchronously, so we need to poll for the email.
        # This verifies that the notification threshold (0.1%) was exceeded and
        # an alert was properly sent to the configured admin email address.
        retries_left = 100
        received_email = False
        while retries_left and not received_email:
            retries_left -= 1
            try:
                assert _smtpd.messages
                message = _smtpd.messages[-1]
                assert message["To"] == _admin_email
                assert (soup := _extract_html(message))
                assert soup.title
                assert soup.title.string == "Database Usage Notification"
                received_email = True
            except AssertionError:
                if retries_left:
                    sleep(0.2)
                    continue
                raise

        assert received_email, "Email notification should be received"

        # ========================================================================
        # Verify span insertion operations are blocked for admin secret
        # ========================================================================
        # Spans are telemetry data that get stored in the database. When the
        # insertion blocking threshold (0.2%) is exceeded, these operations
        # should fail to prevent further database growth. This tests both
        # HTTP and gRPC span export protocols.

        # Test span exporters fail due to insertion blocking
        headers: dict[str, Any] = {"authorization": f"Bearer {_admin_secret}"}
        trace_id = int.from_bytes(token_bytes(16), "big")
        span_id = int.from_bytes(token_bytes(8), "big")
        spans = [ReadableSpan(token_hex(8), SpanContext(trace_id, span_id, False))]

        res = _http_span_exporter(_app, headers=headers).export(spans)
        assert res is SpanExportResult.FAILURE, "HTTP export should fail"

        res = _grpc_span_exporter(_app, headers=headers).export(spans)
        assert res is SpanExportResult.FAILURE, "gRPC export should fail"

        # ========================================================================
        # Verify REST API create operations are blocked for admin secret
        # ========================================================================
        # Project creation involves database insertions, so these operations
        # should be blocked with HTTP 503 (Service Unavailable) when the
        # insertion blocking threshold is exceeded.

        # Test REST API create operations fail due to insertion blocking
        client = _httpx_client(_app, _admin_secret)
        json_: dict[str, Any] = {"name": token_hex(8)}
        resp = client.post(url="v1/projects", json=json_)
        assert resp.status_code == 507, "REST API should return 507"

        # ========================================================================
        # Verify REST API get operations are not blocked for admin secret
        # ========================================================================
        # Read operations don't increase database storage, so they should
        # continue to work normally even when insertions are blocked.
        # This ensures administrators can still monitor and troubleshoot.
        for path in ["projects", "users"]:
            resp = client.get(url=f"v1/{path}")
            assert resp.is_success, f"{path} GET should succeed"

        # ========================================================================
        # Verify authentication operations still work
        # ========================================================================
        # Authentication operations are critical for system management and
        # should continue to function even when data insertions are blocked.
        # This ensures administrators can still access the system to resolve
        # disk usage issues. Auth operations typically don't involve large
        # data insertions, so they're safe to allow.

        # Test password reset email can still be sent
        json_ = {"email": _admin_email}
        resp = client.post("auth/password-reset-email", json=json_)
        assert resp.is_success, "Password reset email request should succeed"

        # Wait for and extract password reset token from email
        retries_left = 100
        reset_token: Optional[_PasswordResetToken] = None
        while retries_left and not reset_token:
            retries_left -= 1
            try:
                assert _smtpd.messages
                message = _smtpd.messages[-1]
                assert message["To"] == _admin_email
                reset_token = _extract_password_reset_token(message)
            except AssertionError:
                if retries_left:
                    sleep(0.2)
                    continue
                raise

        assert reset_token, "Password reset token should be extracted from email"

        # Test password reset works
        new_password = token_hex(16)
        json_ = {"token": reset_token, "password": new_password}
        resp = _httpx_client(_app).post("auth/password-reset", json=json_)
        assert resp.is_success, "Password reset should succeed"

        # Test user can log in (and log out) with new password
        _log_out(_app, _log_in(_app, new_password, email=_admin_email).access_token)
        access_token = _log_in(_app, new_password, email=_admin_email).access_token
        client = _httpx_client(_app, access_token)

        # ========================================================================
        # Verify GraphQL mutation create is blocked
        # ========================================================================
        # GraphQL mutations that create new data (API keys, datasets, etc.)
        # should be blocked because they involve database insertions.
        # The system should return "locked" errors for these operations.
        with pytest.raises(Exception, match="locked"):
            _create_api_key(_app, access_token)

        for field in ['createDataset(input:{name:"' + token_hex(8) + '"}){dataset{id}}']:
            query = "mutation{" + field + "}"
            with pytest.raises(Exception, match="locked"):
                _gql(_app, access_token, query=query)

        # ========================================================================
        # Verify GraphQL mutation delete is not blocked
        # ========================================================================
        # Delete operations actually free up database space rather than
        # consuming it, so they should continue to work. This allows
        # administrators to clean up data to resolve disk usage issues.
        for field in ['clearProject(input:{id:"UHJvamVjdDox"}){__typename}']:
            query = "mutation{" + field + "}"
            _gql(_app, access_token, query=query)

        # ========================================================================
        # Verify GraphQL query is not blocked
        # ========================================================================
        # Read queries don't consume database storage, so they should
        # continue to work normally for monitoring and troubleshooting.
        for field in ["datasets", "projects", "prompts", "users"]:
            query = "{" + field + "{__typename}}"
            _gql(_app, access_token, query=query)

        # ========================================================================
        # Verify REST POST create is blocked
        # ========================================================================
        # Final verification that REST API create operations are consistently
        # blocked across different authentication methods (admin secret vs user token).
        # This ensures the blocking behavior is comprehensive and not bypass-able.
        json_ = {"name": token_hex(8)}
        resp = client.post(url="v1/projects", json=json_)
        assert resp.status_code == 507, "Project creation should fail with 507"

        # ========================================================================
        # Verify REST GET is not blocked
        # ========================================================================
        # Final verification that read operations remain available for
        # system monitoring and troubleshooting, regardless of authentication method.
        for path in ["projects", "users"]:
            resp = client.get(url=f"v1/{path}")
            assert resp.is_success, f"{path} GET should succeed"
