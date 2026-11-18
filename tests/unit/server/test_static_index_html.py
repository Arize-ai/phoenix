"""The SPA fallback injects PostHog settings into window.Config only when configured."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from phoenix.config import PostHogConfig
from phoenix.server.app import AppConfig, Static


async def _render_index_html(*, directory: Path, posthog: Optional[PostHogConfig]) -> str:
    static = Static(
        directory=directory,
        app_config=AppConfig(
            is_development=True,
            web_manifest_path=directory / "does-not-exist.json",
            authentication_enabled=False,
            auth_error_messages={},
            oauth2_idps=[],
            posthog=posthog,
        ),
    )
    response = await static.get_response(
        "projects",
        {
            "type": "http",
            "method": "GET",
            "path": "/projects",
            "root_path": "",
            "headers": [],
            "query_string": b"",
        },
    )
    assert response.status_code == 200
    return bytes(response.body).decode()


async def test_posthog_is_null_when_not_configured(tmp_path: Path) -> None:
    html = await _render_index_html(directory=tmp_path, posthog=None)
    assert "posthog: null," in html


async def test_posthog_settings_are_injected_when_configured(tmp_path: Path) -> None:
    html = await _render_index_html(
        directory=tmp_path,
        posthog=PostHogConfig(api_key="phc_test", host="https://eu.i.posthog.com"),
    )
    assert 'posthog: {"apiHost": "https://eu.i.posthog.com", "apiKey": "phc_test"},' in html


async def test_posthog_settings_cannot_break_out_of_the_script_tag(tmp_path: Path) -> None:
    html = await _render_index_html(
        directory=tmp_path,
        posthog=PostHogConfig(api_key="</script><script>alert(1)", host="https://h.example"),
    )
    assert "</script><script>alert(1)" not in html
