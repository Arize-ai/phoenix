"""The execute_browser_action worker asset response must carry the sandbox CSP.

A worker global scope adopts the CSP delivered with its script response, so
this header is the platform-level network boundary for execute_browser_action scripts:
`connect-src 'none'` blocks fetch/XHR/WebSocket/sendBeacon even if the
worker's removed globals are somehow recovered, and `script-src
'unsafe-eval'` permits the `new Function` the worker needs while forbidding
module fetches — including `eval("import(...)")` payloads that source-level
scanning cannot see.
"""

from __future__ import annotations

from typing import Any, MutableMapping
from unittest.mock import AsyncMock

import pytest

from phoenix.server.middleware.ui_script_worker_csp import (
    SANDBOX_CSP,
    UIScriptWorkerCSPMiddleware,
)


def _scope(path: str, root_path: str = "", scope_type: str = "http") -> dict[str, Any]:
    return {
        "type": scope_type,
        "method": "GET",
        "path": path,
        "root_path": root_path,
        "headers": [],
        "query_string": b"",
    }


async def _run(
    scope: dict[str, Any], content_type: bytes = b"text/javascript"
) -> list[MutableMapping[str, Any]]:
    sent: list[MutableMapping[str, Any]] = []

    async def send(message: MutableMapping[str, Any]) -> None:
        sent.append(message)

    async def app(_scope: Any, _receive: Any, send: Any) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", content_type)],
            }
        )
        await send({"type": "http.response.body", "body": b"// js"})

    await UIScriptWorkerCSPMiddleware(app)(scope, AsyncMock(), send)
    return sent


async def test_worker_asset_response_gets_sandbox_csp() -> None:
    messages = await _run(_scope("/assets/UIScriptWorker-a1b2c3.js"))
    response_start = messages[0]
    headers = dict(response_start["headers"])
    csp = headers[b"content-security-policy"].decode()
    assert csp == SANDBOX_CSP
    assert "connect-src 'none'" in csp
    assert "script-src 'unsafe-eval'" in csp
    assert "worker-src 'none'" in csp


async def test_worker_asset_matched_under_host_root_path() -> None:
    # Behind PHOENIX_HOST_ROOT_PATH the scope path carries the prefix; the
    # middleware must still recognize the asset.
    messages = await _run(_scope("/phoenix/assets/UIScriptWorker-a1b2c3.js", "/phoenix"))
    headers = dict(messages[0]["headers"])
    assert headers.get(b"content-security-policy") is not None


@pytest.mark.parametrize(
    "path",
    [
        pytest.param("/assets/index-a1b2c3.js", id="ordinary_js_bundle"),
        pytest.param("/assets/UIScriptWorker-a1b2c3.js.map", id="source_map"),
        pytest.param("/assets/UIScriptWorker-a1b2c3.ts", id="unbundled_typescript_asset"),
        pytest.param("/index.html", id="html_document"),
        pytest.param("/v1/traces", id="api_route"),
    ],
)
async def test_other_responses_are_untouched(path: str) -> None:
    messages = await _run(_scope(path))
    headers = dict(messages[0]["headers"])
    assert b"content-security-policy" not in headers


async def test_spa_html_fallback_for_worker_path_is_untouched() -> None:
    # A missing hashed worker URL is served as the SPA document. Stamping the
    # worker CSP on HTML would break the page without sandboxing any script.
    messages = await _run(
        _scope("/assets/UIScriptWorker-a1b2c3.js"),
        content_type=b"text/html; charset=utf-8",
    )
    headers = dict(messages[0]["headers"])
    assert b"content-security-policy" not in headers


async def test_non_http_scopes_pass_through() -> None:
    app = AsyncMock()
    receive, send = AsyncMock(), AsyncMock()
    scope = _scope("/assets/UIScriptWorker-a1b2c3.js", scope_type="websocket")
    await UIScriptWorkerCSPMiddleware(app)(scope, receive, send)
    app.assert_awaited_once_with(scope, receive, send)
