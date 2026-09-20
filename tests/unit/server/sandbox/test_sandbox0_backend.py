from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from pydantic import SecretStr

pytest.importorskip("sandbox0")

from sandbox0.apispec.client import AuthenticatedClient
from sandbox0.response_normalize import normalize_response_hook_async

from phoenix.server.sandbox.sandbox0_backend import Sandbox0Adapter, Sandbox0SandboxBackend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import (
    ExecutionResult,
    Sandbox0Config,
    Sandbox0Credentials,
    Sandbox0Deployment,
)


def backend(**config: Any) -> Sandbox0SandboxBackend:
    return Sandbox0SandboxBackend(
        Sandbox0Config(language="PYTHON", **config),
        Sandbox0Credentials(SANDBOX0_API_KEY=SecretStr("provider-secret")),
        Sandbox0Deployment(),
        {"TEST_SECRET": "user-secret"},
    )


class API:
    """Wire-level fixture: exercise generated SDK serialization and envelope parsing."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.sandboxes: set[str] = set()
        self.claims = 0
        self.contexts = 0
        self.exit_code = 0
        self.stderr = ""
        self.forever = False
        self.fail_create = False
        self.missing_context = False
        self.status_code = 200

    def respond(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.method == "POST" and path == "/api/v1/sandboxes":
            self.claims += 1
            sid = f"sb-{self.claims}"
            self.sandboxes.add(sid)
            return httpx.Response(
                201,
                json={
                    "success": True,
                    "data": {
                        "sandbox_id": sid,
                        "template": "default",
                        "runtime_id": "rt",
                        "status": "running",
                        "cluster_id": "cluster",
                    },
                },
            )
        sid = path.split("/")[4]
        if sid not in self.sandboxes:
            return httpx.Response(
                404,
                json={
                    "success": True,
                    "error": {"code": "not_found", "message": "sandbox not found"},
                },
            )
        if path.endswith("/contexts") and request.method == "POST":
            if self.fail_create:
                return httpx.Response(
                    500,
                    json={"success": True, "error": {"code": "create_failed", "message": "failed"}},
                )
            self.contexts += 1
            return httpx.Response(
                201, json={"success": True, "data": self.context(f"ctx-{self.contexts}", True)}
            )
        if "/contexts/" in path:
            if request.method == "DELETE":
                return httpx.Response(200, json={"success": True, "data": {"deleted": True}})
            if self.missing_context:
                return httpx.Response(
                    404,
                    json={
                        "success": True,
                        "error": {"code": "context_not_found", "message": "context not found"},
                    },
                )
            return httpx.Response(
                200, json={"success": True, "data": self.context(path.split("/")[-1], self.forever)}
            )
        if request.method == "DELETE":
            self.sandboxes.remove(sid)
            return httpx.Response(202, json={"success": True, "data": {"message": "deleted"}})
        if self.status_code != 200:
            return httpx.Response(
                self.status_code,
                json={"success": True, "error": {"code": "unavailable", "message": "try later"}},
            )
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "id": sid,
                    "template_id": "default",
                    "team_id": "team",
                    "status": "running",
                    "paused": False,
                    "auto_resume": False,
                    "runtime_id": "rt",
                    "runtime_generation": 1,
                    "claimed_at": "2026-09-20T00:00:00Z",
                    "created_at": "2026-09-20T00:00:00Z",
                    "updated_at": "2026-09-20T00:00:00Z",
                },
            },
        )

    def context(self, cid: str, running: bool) -> dict[str, Any]:
        result: dict[str, Any] = {
            "id": cid,
            "type": "cmd",
            "running": running,
            "paused": False,
            "created_at": "2026-09-20T00:00:00Z",
        }
        if not running:
            result.update(
                stdout="result\n", stderr=self.stderr, exit_code=self.exit_code, state="exited"
            )
        return result

    def bind(self, instance: Sandbox0SandboxBackend) -> None:
        @asynccontextmanager
        async def client(timeout: float = 30) -> AsyncIterator[AuthenticatedClient]:
            api = AuthenticatedClient(base_url="https://test.invalid", token="provider-secret")
            async with httpx.AsyncClient(
                base_url="https://test.invalid",
                transport=httpx.MockTransport(self.respond),
                event_hooks={"response": [normalize_response_hook_async]},
            ) as http:
                api.set_async_httpx_client(http)
                yield api

        instance._client = client  # type: ignore[method-assign]


@pytest.fixture
def api() -> API:
    return API()


async def test_ephemeral_exec_cleans_context_and_sandbox(api: API) -> None:
    b = backend()
    api.bind(b)
    result = await b.execute("print(1)", "test", timeout=5)
    assert result == ExecutionResult(stdout="result\n", stderr="")
    assert api.sandboxes == set()
    request = next(r for r in api.requests if r.url.path.endswith("/contexts"))
    data = json.loads(request.content)
    assert data["cmd"]["command"] == ["python3", "-c", "print(1)"]
    assert data["env_vars"] == {"TEST_SECRET": "user-secret"}
    assert "provider-secret" not in request.content.decode()
    assert data["wait_until_done"] is False
    assert data["ttl_sec"] == 5
    assert any(r.method == "DELETE" and "/contexts/" in r.url.path for r in api.requests)


async def test_reuse_validates_then_recreates_missing_session(api: API) -> None:
    b = backend()
    api.bind(b)
    first = await b.find_or_create_session("test")
    assert await b.find_or_create_session("test") == first
    assert api.claims == 1
    api.sandboxes.clear()
    assert await b.find_or_create_session("test") != first
    assert api.claims == 2
    await b.close_session("test")
    await b.close_session("test")
    assert not api.sandboxes


async def test_transient_lookup_failure_does_not_create_duplicate(api: API) -> None:
    b = backend()
    api.bind(b)
    await b.find_or_create_session("test")
    api.status_code = 503
    with pytest.raises(Exception):
        await b.find_or_create_session("test")
    assert api.claims == 1


async def test_nonzero_exit_is_error(api: API) -> None:
    b = backend()
    api.bind(b)
    api.exit_code = 2
    api.stderr = "bad code"
    result = await b.execute("raise ValueError()", "test")
    assert result.error == "bad code"
    assert result.stdout == "result\n"
    assert not api.sandboxes


async def test_missing_context_does_not_trigger_session_rebind(api: API) -> None:
    b = backend()
    api.bind(b)
    api.missing_context = True
    async with SandboxSessionManager().acquire(b, "test") as session:
        result = await session.execute("print(1)")
    assert not result.success
    assert api.claims == 1
    await b.close_session("test")


async def test_manager_rebinds_confirmed_missing_sandbox(api: API) -> None:
    b = backend()
    api.bind(b)
    manager = SandboxSessionManager()
    async with manager.acquire(b, "test") as session:
        api.sandboxes.clear()
        assert (await session.execute("print(1)")).success
    assert api.claims == 2
    await manager.stop()
    assert not api.sandboxes


async def test_timeout_cleans_process_and_ephemeral_sandbox(api: API) -> None:
    b = backend()
    api.bind(b)
    api.forever = True
    with pytest.raises(asyncio.TimeoutError):
        await b.execute("while True: pass", "test", timeout=0)
    assert not api.sandboxes
    assert any(r.method == "DELETE" and "/contexts/" in r.url.path for r in api.requests)


async def test_cancel_during_claim_waits_for_owned_resource_cleanup() -> None:
    b = backend()
    started = asyncio.Event()
    release = asyncio.Event()

    async def create() -> str:
        started.set()
        await release.wait()
        return "owned"

    b._create = create  # type: ignore[method-assign]
    b._delete = AsyncMock()  # type: ignore[method-assign]
    task = asyncio.create_task(b.execute("pass", "test"))
    await started.wait()
    task.cancel()
    release.set()
    with pytest.raises(asyncio.CancelledError):
        await task
    b._delete.assert_awaited_once_with("owned")


async def test_dependencies_install_once_without_user_secrets(api: API) -> None:
    b = backend(dependencies={"packages": ["requests==2.32.3"]})
    api.bind(b)
    await b.find_or_create_session("test")
    await b.find_or_create_session("test")
    commands = [json.loads(r.content) for r in api.requests if r.url.path.endswith("/contexts")]
    assert len(commands) == 1
    assert commands[0]["cmd"]["command"] == [
        "python3",
        "-m",
        "pip",
        "install",
        "--target",
        "/workspace/.phoenix-python",
        "--upgrade",
        "--",
        "requests==2.32.3",
    ]
    assert commands[0]["env_vars"] == {}
    await b.close_session("test")


async def test_failed_install_cleans_sandbox(api: API) -> None:
    b = backend(dependencies={"packages": ["missing-package"]})
    api.bind(b)
    api.exit_code = 1
    with pytest.raises(RuntimeError, match="dependency installation failed"):
        await b.find_or_create_session("test")
    assert not api.sandboxes
    assert not b._sessions


async def test_deny_network_and_hard_ttl_are_sent_on_claim(api: API) -> None:
    b = backend(internet_access={"mode": "deny"})
    api.bind(b)
    await b.execute("pass", "test")
    config = json.loads(api.requests[0].content)["config"]
    assert config["network"]["mode"] == "block-all"
    assert config["hard_ttl"] == 3600
    assert config["auto_resume"] is False


def test_fingerprint_includes_runtime_and_deployment_but_not_secret_rotation() -> None:
    b = backend()
    other = backend()
    other._user_env = {"TEST_SECRET": "rotated"}
    assert b.config_fingerprint() == other.config_fingerprint()
    other._deployment = Sandbox0Deployment(template="custom")
    assert b.config_fingerprint() != other.config_fingerprint()
    assert (
        b.config_fingerprint()
        != backend(dependencies={"packages": ["requests"]}).config_fingerprint()
    )
    assert b.config_fingerprint() != backend(internet_access={"mode": "deny"}).config_fingerprint()
    assert b.secret_values == frozenset({"provider-secret", "user-secret"})


def test_adapter_rejects_invalid_env_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANDBOX0_API_URL", "file:///etc/passwd")
    with pytest.raises(ValueError):
        Sandbox0Adapter().build_backend(
            Sandbox0Config(language="PYTHON"),
            credentials=Sandbox0Credentials(SANDBOX0_API_KEY=SecretStr("key")),
            deployment=Sandbox0Deployment(),
        )


def test_typescript_uses_modern_node_template_unless_overridden() -> None:
    credentials = Sandbox0Credentials(SANDBOX0_API_KEY=SecretStr("key"))
    config = Sandbox0Config(language="TYPESCRIPT")
    default = Sandbox0SandboxBackend(config, credentials, Sandbox0Deployment())
    custom = Sandbox0SandboxBackend(config, credentials, Sandbox0Deployment(template="node-custom"))
    assert default._deployment.template == "coding-agent"
    assert custom._deployment.template == "node-custom"
    assert backend()._deployment.template == "default"


async def test_python_dependencies_are_on_each_execution_path(api: API) -> None:
    b = backend(dependencies={"packages": ["requests"]})
    api.bind(b)
    handle = await b.find_or_create_session("test")
    result = await b.execute_in_session(handle, "import requests", 10)
    assert result.success
    commands = [json.loads(r.content) for r in api.requests if r.url.path.endswith("/contexts")]
    assert commands[-1]["env_vars"]["PYTHONPATH"] == "/workspace/.phoenix-python"
    assert commands[-1]["env_vars"]["TEST_SECRET"] == "user-secret"
    await b.close_session("test")


async def test_cancel_during_execution_deletes_only_its_context(api: API) -> None:
    b = backend()
    api.bind(b)
    handle = await b.find_or_create_session("test")
    api.forever = True
    task = asyncio.create_task(b.execute_in_session(handle, "pass", 30))
    for _ in range(100):
        if api.contexts:
            break
        await asyncio.sleep(0.001)
    assert api.contexts == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert api.sandboxes == {handle}
    assert any(r.method == "DELETE" and "/contexts/" in r.url.path for r in api.requests)
    await b.close_session("test")
