from __future__ import annotations

import base64
import json
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from phoenix.server.sandbox import docker_backend
from phoenix.server.sandbox.docker_backend import DockerSandboxBackend


def _b64(value: str) -> str:
    return base64.b64encode(value.encode()).decode()


def _jwt(claims: dict[str, Any]) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"header.{payload}.signature"


_ACCESS_TOKEN = _jwt({"exp": 4_102_444_800})


def _resource(uid: str, status: str, created_at: str = "2026-09-25T00:00:00Z") -> dict[str, Any]:
    core: dict[str, Any] = {"status": status, "createdAt": created_at, "etag": f'"{status}"'}
    if status == "running":
        core["endpoint"] = {"uri": f"https://{uid}.sandboxes.example/api/"}
    return {"name": f"sandboxes/{uid}", "uid": uid, "core": core}


class _FakeDockerSandboxes:
    def __init__(
        self,
        *,
        listed: list[dict[str, Any]] | None = None,
        exec_response: dict[str, Any] | None = None,
    ) -> None:
        self.requests: list[httpx.Request] = []
        self.listed = listed or []
        self.exec_response = exec_response or {"exitCode": 0, "stdout": _b64("hello\n")}

    def calls(self) -> list[tuple[str, str, str]]:
        return [(r.method, r.url.host, r.url.path) for r in self.requests]

    def json_body(self, method: str, path_suffix: str) -> Any:
        request = next(
            r for r in self.requests if r.method == method and r.url.path.endswith(path_suffix)
        )
        return json.loads(request.content)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.url.host == "hub.docker.com":
            if path.endswith("/ListPolicies"):
                return httpx.Response(200, json={"policies": []})
            if path.endswith("/CreatePolicy"):
                return httpx.Response(200, json={"policy": {"id": "pol-deny"}})
            return httpx.Response(200, json={"access_token": _ACCESS_TOKEN})
        if request.url.host.endswith(".sandboxes.example"):
            if path == "/api/v1/files/content":
                return httpx.Response(200, json={"info": {}})
            if path == "/api/v1/processes/exec":
                return httpx.Response(200, json=self.exec_response)
        routes = {
            ("GET", "/sandboxes/v1/sandboxes"): (200, {"sandboxes": self.listed}),
            ("POST", "/sandboxes/v1/sandboxes"): (202, _resource("sb-new", "creating")),
            ("GET", "/sandboxes/v1/sandboxes/sb-new"): (200, _resource("sb-new", "running")),
            ("POST", "/sandboxes/v1/sandboxes/sb-new/endpoint-credentials"): (
                200,
                {"token": "scoped-token"},
            ),
            ("POST", "/sandboxes/v1/sandboxes/sb-old/endpoint-credentials"): (
                200,
                {"token": "scoped-token"},
            ),
            ("DELETE", "/sandboxes/v1/sandboxes/sb-new"): (204, None),
        }
        status, body = routes.get((request.method, path), (404, {"code": "notFound"}))
        return httpx.Response(status, json=body) if body is not None else httpx.Response(status)


def _backend(fake: _FakeDockerSandboxes, **kwargs: Any) -> DockerSandboxBackend:
    return DockerSandboxBackend(
        docker_id=SecretStr("docker-user"),
        pat=SecretStr("dckr_pat_secret"),
        language="PYTHON",
        transport=httpx.MockTransport(fake.handler),
        **kwargs,
    )


async def test_execute_runs_one_shot_sandbox_lifecycle(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(docker_backend, "_READY_POLL_SECONDS", 0)
    fake = _FakeDockerSandboxes()
    backend = _backend(fake, user_env={"API_TOKEN": "user-secret"}, deny_internet=True)

    result = await backend.execute("print('hello')", session_key="", timeout=30)

    assert result.error is None
    assert result.stdout == "hello\n"
    api = "connect.docker.com"
    policies = "/rpc/docker.governance.policyconfig.v1.UserPolicyManagementService"
    assert fake.calls() == [
        ("POST", "hub.docker.com", "/v2/auth/token"),
        ("POST", "hub.docker.com", f"{policies}/ListPolicies"),
        ("POST", "hub.docker.com", f"{policies}/CreatePolicy"),
        ("POST", api, "/sandboxes/v1/sandboxes"),
        ("GET", api, "/sandboxes/v1/sandboxes/sb-new"),
        ("POST", api, "/sandboxes/v1/sandboxes/sb-new/endpoint-credentials"),
        ("PUT", "sb-new.sandboxes.example", "/api/v1/files/content"),
        ("POST", "sb-new.sandboxes.example", "/api/v1/processes/exec"),
        ("GET", api, "/sandboxes/v1/sandboxes/sb-new"),
        ("DELETE", api, "/sandboxes/v1/sandboxes/sb-new"),
    ]
    assert fake.json_body("POST", "/v2/auth/token") == {
        "identifier": "docker-user",
        "secret": "dckr_pat_secret",
    }
    assert fake.json_body("POST", "/v1/sandboxes") == {
        "imageRef": "python:3.13-slim",
        "resources": {"cpus": 2, "memoryMib": 4096},
        "features": {"timeouts": {"timeout": "600s", "onTimeout": "delete"}},
        "policyIds": ["pol-deny"],
    }
    created_policy = fake.json_body("POST", "/CreatePolicy")["policy"]
    assert created_policy["scope"] == {"boundTargetsOnly": True}
    assert created_policy["allowlist"]["rules"][0]["decision"] == "ALLOWLIST_DECISION_DENY"
    upload = next(r for r in fake.requests if r.method == "PUT")
    assert upload.content == b"print('hello')"
    exec_request = next(r for r in fake.requests if r.url.path.endswith("/processes/exec"))
    assert exec_request.headers["Authorization"] == "Bearer scoped-token"
    assert json.loads(exec_request.content) == {
        "cmd": ["timeout", "-s", "KILL", "30", "python3", upload.url.params["path"]],
        "workingDir": "/tmp",
        "env": {"API_TOKEN": "user-secret"},
    }
    delete = fake.requests[-1]
    assert delete.headers["Authorization"] == f"Bearer {_ACCESS_TOKEN}"
    assert delete.headers["If-Match"] == '"running"'
    assert backend.secret_values == {"user-secret", "dckr_pat_secret"}


async def test_find_or_create_session_reuses_oldest_running_sandbox_by_display_name() -> None:
    fake = _FakeDockerSandboxes(
        listed=[
            _resource("sb-young", "running", created_at="2026-09-25T00:05:00Z"),
            _resource("sb-old", "running", created_at="2026-09-25T00:00:00Z"),
        ]
    )
    backend = _backend(fake)

    handle = await backend.find_or_create_session("dataset-eval#fingerprint")
    result = await backend.execute_in_session(handle, "print('hello')")

    assert result.stdout == "hello\n"
    display_name = backend.provider_session_id("dataset-eval#fingerprint")
    list_request = next(r for r in fake.requests if r.url.path == "/sandboxes/v1/sandboxes")
    assert list_request.method == "GET"
    assert list_request.url.params["filter"] == f"display_name={display_name},status=running"
    assert ("POST", "connect.docker.com", "/sandboxes/v1/sandboxes") not in fake.calls()
    assert ("PUT", "sb-old.sandboxes.example", "/api/v1/files/content") in fake.calls()


async def test_timeout_kill_surfaces_as_timed_out() -> None:
    fake = _FakeDockerSandboxes(
        listed=[_resource("sb-old", "running")],
        exec_response={"exitCode": -1},
    )
    backend = _backend(fake)

    handle = await backend.find_or_create_session("key")
    result = await backend.execute_in_session(handle, "while True: pass", timeout=5)

    assert result.error == "Execution timed out after 5s"
