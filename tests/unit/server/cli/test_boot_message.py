import sys
from dataclasses import replace

import pytest

from phoenix.server.cli.boot_message import BootMessage


def _boot_message() -> BootMessage:
    return BootMessage(
        version="1.2.3",
        ui_url="http://localhost:6006/phoenix",
        rest_api_url="http://localhost:6006/phoenix/v1",
        graphql_url="http://localhost:6006/phoenix/graphql",
        mcp_url="http://localhost:6006/phoenix/mcp",
        read_only=False,
        otlp_grpc_url="http://localhost:4317",
        otlp_http_url="http://localhost:6006/phoenix/v1/traces",
        database="sqlite:///phoenix.db",
        database_schema=None,
        read_replica=None,
        storage_capacity_gibibytes=None,
        retention_policy_days=0,
        auth_enabled=False,
        basic_auth_disabled=False,
        oauth2_idp_names=[],
        ldap_enabled=False,
        tls_enabled_for_http=False,
        tls_enabled_for_grpc=False,
        tls_verify_client=False,
        allowed_origins=None,
        sandbox_providers=[("e2b", True), ("modal", False)],
        agent_assistant_enabled=True,
        docs_mcp_url=None,
        prometheus_enabled=False,
        smtp_hostname="",
        telemetry_enabled=True,
    )


def test_render_displays_configured_urls() -> None:
    rendered = _boot_message().render(unicode_ok=True)

    assert "http://localhost:6006/phoenix/v1" in rendered
    assert "http://localhost:6006/phoenix/graphql" in rendered
    assert "http://localhost:6006/phoenix/mcp" in rendered
    assert "http://localhost:6006/phoenix/v1/traces" in rendered


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Windows output is ASCII-sanitized, which removes the Unicode dividers",
)
def test_render_uses_uniform_dividers_and_places_tracing_section_last() -> None:
    rendered = _boot_message().render(unicode_ok=True)

    headers = [line for line in rendered.splitlines() if line.startswith(("──", "━━"))]
    assert len({len(header) for header in headers}) == 1
    assert "Server" in headers[-2]
    assert "Tracing" in headers[-1]


def test_render_omits_development_section_by_default() -> None:
    rendered = _boot_message().render(unicode_ok=True)

    assert "Development" not in rendered


def test_render_shows_development_section_when_dev_tooling_configured() -> None:
    message = replace(
        _boot_message(),
        dev_mode=True,
        debug_logging=True,
        dev_vite_url="http://localhost:5173",
        debugpy_url="localhost:5678",
    )

    rendered = message.render(unicode_ok=True)

    assert "Development" in rendered
    assert "Dev mode" in rendered
    assert "Debug logging" in rendered
    assert "http://localhost:5173" in rendered
    assert "localhost:5678" in rendered


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Windows output is ASCII-sanitized, which removes the Unicode dividers",
)
def test_render_keeps_uniform_dividers_with_development_section() -> None:
    message = replace(_boot_message(), dev_vite_url="http://localhost:5173")

    rendered = message.render(unicode_ok=True)

    headers = [line for line in rendered.splitlines() if line.startswith(("──", "━━"))]
    assert any("Development" in header for header in headers)
    assert len({len(header) for header in headers}) == 1


def test_render_without_unicode_omits_logo_and_is_ascii() -> None:
    rendered = _boot_message().render(unicode_ok=False)

    rendered.encode("ascii")
    assert "██████" not in rendered
    assert "Arize Phoenix v1.2.3 - AI Observability & Evaluation" in rendered


def test_render_sanitizes_for_windows_even_when_unicode_is_forced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("phoenix.utilities.sys.platform", "win32")

    rendered = _boot_message().render(unicode_ok=True)

    rendered.encode("ascii")
    assert "██████" not in rendered
