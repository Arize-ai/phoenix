"""Content-Security-Policy for the execute_browser_action script worker asset.

execute_browser_action runs LLM-written JavaScript in a same-origin web worker and relies
on hygiene inside the worker (removing network-capable globals, rejecting
dynamic ``import()`` in source) to keep the audited ``ui.*`` bridge the only
way out. Source-level hygiene can never be complete — ``eval("import(...)")``
carries its payload as runtime data, which no scanner can see — so the real
network boundary is this CSP. Per spec, a worker global scope adopts the CSP
delivered with its script's response, which is exactly what this middleware
stamps on the worker asset:

- ``script-src 'unsafe-eval'`` permits the ``new Function`` the worker
  legitimately needs, while forbidding every module fetch (dynamic
  ``import()`` of any URL, including eval'd payloads);
- ``connect-src 'none'`` blocks fetch/XHR/WebSocket/EventSource/sendBeacon
  outright, so even a recovered global has no network;
- ``worker-src 'none'`` bars nested workers.

Only the production asset (``assets/jsSandboxWorker-<hash>.js``, emitted by the
Vite build) is matched; the dev server serves the worker module itself, and
dev-mode execution is not part of the security posture.
"""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import TYPE_CHECKING

from starlette.datastructures import MutableHeaders

from phoenix.server.utils import strip_root_path

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Basename prefix of the emitted worker chunk (Vite appends a content hash).
_WORKER_ASSET_PREFIX = "jsSandboxWorker"

SANDBOX_CSP = "script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'"


def _is_worker_js_path(path: str) -> bool:
    name = PurePosixPath(path).name
    return name.startswith(_WORKER_ASSET_PREFIX) and name.endswith(".js")


class JSSandboxWorkerCSPMiddleware:
    """Stamps the sandbox CSP on responses for the execute_browser_action worker asset."""

    def __init__(self, app: "ASGIApp") -> None:
        self.app = app

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        path = strip_root_path(scope, scope.get("path", ""))
        if not _is_worker_js_path(path):
            await self.app(scope, receive, send)
            return

        async def send_with_csp(message: "Message") -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                # SPA fallbacks for missing hashed paths are text/html; only
                # a real JavaScript worker response should carry this CSP.
                if "javascript" in headers.get("content-type", ""):
                    headers["content-security-policy"] = SANDBOX_CSP
            await send(message)

        await self.app(scope, receive, send_with_csp)
