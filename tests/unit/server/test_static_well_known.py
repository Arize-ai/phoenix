"""The SPA static fallback must never mask /.well-known/ URLs.

RFC 8615 consumers (OAuth/OIDC discovery, MCP clients) probe several
/.well-known/ candidates and rely on a 404 to move to the next one. Serving
index.html with a 200 there reads as a malformed discovery document and aborts
the client's discovery instead.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from starlette.exceptions import HTTPException

from phoenix.server.app import AppConfig, Static


def _static(directory: Path) -> Static:
    return Static(
        directory=directory,
        app_config=AppConfig(
            is_development=True,
            web_manifest_path=directory / "does-not-exist.json",
            authentication_enabled=False,
            auth_error_messages={},
            oauth2_idps=[],
        ),
    )


def _scope(path: str) -> dict[str, object]:
    return {
        "type": "http",
        "method": "GET",
        "path": path,
        "root_path": "",
        "headers": [],
        "query_string": b"",
    }


async def test_missing_well_known_document_is_a_404_not_index_html(tmp_path: Path) -> None:
    static = _static(tmp_path)
    with pytest.raises(HTTPException) as exc_info:
        await static.get_response(
            ".well-known/openid-configuration",
            _scope("/.well-known/openid-configuration"),
        )
    assert exc_info.value.status_code == 404


async def test_files_that_exist_are_still_served(tmp_path: Path) -> None:
    (tmp_path / "real.txt").write_text("served")
    static = _static(tmp_path)
    response = await static.get_response("real.txt", _scope("/real.txt"))
    assert response.status_code == 200
