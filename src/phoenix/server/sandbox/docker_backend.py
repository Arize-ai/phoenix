"""Docker Sandboxes backend over the Docker Cloud Sandboxes REST API."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, AsyncIterator, ClassVar, Mapping, Optional, Sequence, Union

import httpx
from pydantic import SecretStr
from typing_extensions import override

from phoenix.db.models import LanguageName

from .types import (
    DockerConfig,
    DockerCredentials,
    DockerDeployment,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    SandboxRuntimeContext,
    compose_secret_values,
    compute_config_fingerprint,
)

logger = logging.getLogger(__name__)

_API_BASE_URL = "https://connect.docker.com/sandboxes"
_TOKEN_EXCHANGE_URL = "https://hub.docker.com/v2/auth/token"
_POLICY_SERVICE_URL = (
    "https://hub.docker.com/rpc/docker.governance.policyconfig.v1.UserPolicyManagementService"
)
_DENY_EGRESS_POLICY_NAME = "phoenix-deny-all-egress"
_DENY_EGRESS_RULE = {
    "type": "ALLOWLIST_RULE_TYPE_NETWORK",
    "name": "deny-all-egress",
    "actions": ["ALLOWLIST_ACTION_NET_CONNECT_TCP", "ALLOWLIST_ACTION_NET_CONNECT_UDP"],
    "resources": ["**"],
    "decision": "ALLOWLIST_DECISION_DENY",
}
# Unbound, a Docker policy applies to every sandbox on the account; bound, only via policyIds.
_DENY_EGRESS_POLICY = {
    "name": _DENY_EGRESS_POLICY_NAME,
    "status": "POLICY_STATUS_ACTIVE",
    "policyType": "POLICY_TYPE_ALLOWLIST",
    "scope": {"boundTargetsOnly": True},
    "allowlist": {"rules": [_DENY_EGRESS_RULE]},
}


@dataclass(frozen=True)
class _Runtime:
    image: str
    argv: tuple[str, ...]
    suffix: str


_RUNTIMES: Mapping[LanguageName, _Runtime] = MappingProxyType(
    {
        "PYTHON": _Runtime(image="python:3.13-slim", argv=("python3",), suffix=".py"),
        "TYPESCRIPT": _Runtime(image="node:24-slim", argv=("node",), suffix=".mts"),
    }
)

_WORKDIR = "/tmp"
_RESOURCES = {"cpus": 2, "memoryMib": 4096}
_SANDBOX_TTL_SECONDS = 600
_READY_TIMEOUT_SECONDS = 300
_READY_POLL_SECONDS = 1.0
_INSTALL_TIMEOUT_SECONDS = 300
_EXEC_HTTP_GRACE_SECONDS = 30
_REQUEST_TIMEOUT_SECONDS = 30.0
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.0
_RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})
_TOKEN_REFRESH_SKEW_SECONDS = 30
# timeout -s KILL signals its own process group too, which Docker reports as exitCode -1.
_TIMEOUT_KILLED_EXIT_CODE = -1


class DockerSandboxesError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        detail = f" ({code})" if code else ""
        super().__init__(f"Docker Sandboxes API error {status_code}{detail}: {message}")
        self.status_code = status_code
        self.code = code


def _checked(response: httpx.Response) -> httpx.Response:
    if not response.is_error:
        return response
    code, message = "", response.reason_phrase
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        code = str(body.get("code") or "")
        message = str(body.get("message") or message)
    raise DockerSandboxesError(response.status_code, code, message)


def _jwt_expiry(token: str) -> float:
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return float(claims["exp"])
    except Exception:
        return time.time() + 60


class _PatAuth:
    def __init__(self, docker_id: SecretStr, pat: SecretStr) -> None:
        self._docker_id = docker_id
        self._pat = pat
        self._token: Optional[str] = None
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def bearer(self, api: _DockerSandboxesAPI) -> str:
        async with self._lock:
            if self._token is None or time.time() >= self._expires_at - _TOKEN_REFRESH_SKEW_SECONDS:
                response = await api.send(
                    "POST",
                    _TOKEN_EXCHANGE_URL,
                    retry=True,
                    json={
                        "identifier": self._docker_id.get_secret_value(),
                        "secret": self._pat.get_secret_value(),
                    },
                )
                token = response.json().get("access_token")
                if not isinstance(token, str) or not token:
                    raise DockerSandboxesError(
                        response.status_code, "", "token exchange returned no access_token"
                    )
                self._token = token
                self._expires_at = _jwt_expiry(token)
            return self._token


class _DockerSandboxesAPI:
    def __init__(self, http: httpx.AsyncClient, auth: _PatAuth) -> None:
        self._http = http
        self._auth = auth

    async def send(
        self,
        method: str,
        url: str,
        *,
        retry: bool,
        bearer: Optional[str] = None,
        headers: Optional[Mapping[str, str]] = None,
        timeout: Union[httpx.Timeout, float, None] = _REQUEST_TIMEOUT_SECONDS,
        **kwargs: Any,
    ) -> httpx.Response:
        request_headers = dict(headers or {})
        if bearer is not None:
            request_headers["Authorization"] = f"Bearer {bearer}"
        for _ in range(_RETRY_ATTEMPTS - 1 if retry else 0):
            try:
                response = await self._http.request(
                    method, url, headers=request_headers, timeout=timeout, **kwargs
                )
            except httpx.TransportError:
                pass
            else:
                if response.status_code not in _RETRYABLE_STATUSES:
                    return _checked(response)
            await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
        return _checked(
            await self._http.request(
                method, url, headers=request_headers, timeout=timeout, **kwargs
            )
        )

    async def _manage(
        self, method: str, path: str, *, retry: bool, **kwargs: Any
    ) -> httpx.Response:
        bearer = await self._auth.bearer(self)
        return await self.send(
            method, f"{_API_BASE_URL}{path}", retry=retry, bearer=bearer, **kwargs
        )

    async def create_sandbox(self, body: Mapping[str, Any]) -> dict[str, Any]:
        response = await self._manage("POST", "/v1/sandboxes", retry=False, json=body)
        return dict(response.json())

    async def get_sandbox(self, uid: str) -> dict[str, Any]:
        response = await self._manage("GET", f"/v1/sandboxes/{uid}", retry=True)
        return dict(response.json())

    async def list_sandboxes(self, filter: str) -> list[dict[str, Any]]:
        sandboxes: list[dict[str, Any]] = []
        params = {"filter": filter}
        while True:
            response = await self._manage("GET", "/v1/sandboxes", retry=True, params=params)
            page = response.json()
            sandboxes.extend(page.get("sandboxes") or [])
            next_page_token = page.get("nextPageToken")
            if not next_page_token:
                return sandboxes
            params = {"filter": filter, "pageToken": next_page_token}

    async def delete_sandbox(self, uid: str) -> None:
        # Docker requires If-Match on delete; a 412 means the etag moved since the read.
        for attempt in range(2):
            try:
                etag = (await self.get_sandbox(uid))["core"]["etag"]
                await self._manage(
                    "DELETE", f"/v1/sandboxes/{uid}", retry=False, headers={"If-Match": etag}
                )
                return
            except DockerSandboxesError as exc:
                if exc.status_code == 404:
                    return
                if exc.status_code != 412 or attempt:
                    raise

    async def _policy_call(
        self, method: str, body: Mapping[str, Any], *, retry: bool
    ) -> dict[str, Any]:
        bearer = await self._auth.bearer(self)
        response = await self.send(
            "POST", f"{_POLICY_SERVICE_URL}/{method}", retry=retry, bearer=bearer, json=body
        )
        return dict(response.json())

    async def deny_egress_policy_id(self) -> str:
        listed = await self._policy_call("ListPolicies", {}, retry=True)
        for policy in listed.get("policies") or []:
            if _is_deny_egress_policy(policy):
                return str(policy["id"])
        created = await self._policy_call(
            "CreatePolicy", {"policy": _DENY_EGRESS_POLICY}, retry=False
        )
        return str(created["policy"]["id"])

    async def endpoint_token(self, uid: str) -> str:
        response = await self._manage(
            "POST",
            f"/v1/sandboxes/{uid}/endpoint-credentials",
            retry=True,
            json={"permissions": ["sandboxesExec", "sandboxesFilesWrite"]},
        )
        return str(response.json()["token"])

    async def write_file(self, endpoint_uri: str, token: str, path: str, content: bytes) -> None:
        await self.send(
            "PUT",
            f"{endpoint_uri}/v1/files/content",
            retry=False,
            bearer=token,
            params={"path": path},
            content=content,
            headers={"Content-Type": "application/octet-stream"},
        )

    async def exec(
        self,
        endpoint_uri: str,
        token: str,
        cmd: Sequence[str],
        *,
        env: Optional[Mapping[str, str]],
        timeout: Optional[float],
    ) -> dict[str, Any]:
        # Never retried: Docker documents that a retried exec may run the command again.
        body: dict[str, Any] = {"cmd": list(cmd), "workingDir": _WORKDIR}
        if env:
            body["env"] = dict(env)
        response = await self.send(
            "POST",
            f"{endpoint_uri}/v1/processes/exec",
            retry=False,
            bearer=token,
            json=body,
            timeout=httpx.Timeout(timeout, connect=_REQUEST_TIMEOUT_SECONDS),
        )
        return dict(response.json())


def _denies_all_egress(rule: Mapping[str, Any]) -> bool:
    return (
        rule.get("type") == _DENY_EGRESS_RULE["type"]
        and rule.get("decision") == _DENY_EGRESS_RULE["decision"]
        and "**" in (rule.get("resources") or [])
        and set(_DENY_EGRESS_RULE["actions"]) <= set(rule.get("actions") or [])
    )


def _is_deny_egress_policy(policy: Mapping[str, Any]) -> bool:
    rules = (policy.get("allowlist") or {}).get("rules") or []
    return (
        policy.get("name") == _DENY_EGRESS_POLICY_NAME
        and policy.get("status") == "POLICY_STATUS_ACTIVE"
        and (policy.get("scope") or {}).get("boundTargetsOnly") is True
        and any(_denies_all_egress(rule) for rule in rules)
    )


@dataclass(frozen=True)
class _Sandbox:
    uid: str
    endpoint_uri: str


def _running_sandbox(resource: Mapping[str, Any]) -> _Sandbox:
    endpoint_uri = str(resource["core"]["endpoint"]["uri"]).rstrip("/")
    return _Sandbox(uid=str(resource["uid"]), endpoint_uri=endpoint_uri)


def _decode(data: Optional[str]) -> str:
    # ExecResponse stdout/stderr are protobuf bytes fields, base64-encoded in JSON.
    if not data:
        return ""
    return base64.b64decode(data).decode("utf-8", errors="replace")


def _timed_out(timeout: int) -> ExecutionResult:
    message = f"Execution timed out after {timeout}s"
    return ExecutionResult(stdout="", stderr=message, error=message)


class DockerSandboxBackend(SandboxBackend):
    provider: ClassVar[str] = "DOCKER"

    def __init__(
        self,
        *,
        docker_id: SecretStr,
        pat: SecretStr,
        language: LanguageName,
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        deny_internet: bool = False,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self._auth = _PatAuth(docker_id, pat)
        self._language: LanguageName = language
        self._runtime = _RUNTIMES[language]
        self._user_env: dict[str, str] = dict(user_env or {})
        self._packages: list[str] = list(packages) if packages else []
        self._deny_internet = deny_internet
        self._transport = transport
        self.secret_values = compose_secret_values(user_env, pat)

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="DOCKER",
            packages=self._packages,
            internet_access_mode="deny" if self._deny_internet else "allow",
            language=self._language,
        )

    @override
    def provider_session_id(self, session_key: str) -> str:
        # displayName allows at most 64 characters of [A-Za-z0-9_-].
        return f"phoenix-{hashlib.sha256(session_key.encode()).hexdigest()[:32]}"

    @asynccontextmanager
    async def _api(self) -> AsyncIterator[_DockerSandboxesAPI]:
        async with httpx.AsyncClient(transport=self._transport) as http:
            yield _DockerSandboxesAPI(http, self._auth)

    def _create_body(self, display_name: Optional[str]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "imageRef": self._runtime.image,
            "resources": dict(_RESOURCES),
            "features": {
                "timeouts": {"timeout": f"{_SANDBOX_TTL_SECONDS}s", "onTimeout": "delete"}
            },
        }
        if display_name is not None:
            body["displayName"] = display_name
        return body

    async def _create(self, api: _DockerSandboxesAPI, display_name: Optional[str]) -> _Sandbox:
        body = self._create_body(display_name)
        if self._deny_internet:
            body["policyIds"] = [await api.deny_egress_policy_id()]
        resource = await api.create_sandbox(body)
        uid = str(resource["uid"])
        try:
            deadline = time.monotonic() + _READY_TIMEOUT_SECONDS
            while (status := resource["core"]["status"]) in ("creating", "starting"):
                if time.monotonic() >= deadline:
                    raise RuntimeError(
                        f"Docker sandbox {uid} did not start within {_READY_TIMEOUT_SECONDS}s"
                    )
                await asyncio.sleep(_READY_POLL_SECONDS)
                resource = await api.get_sandbox(uid)
            if status != "running":
                message = f"Docker sandbox {uid} is {status}"
                failure = (resource.get("failure") or {}).get("message")
                raise RuntimeError(f"{message}: {failure}" if failure else message)
            sandbox = _running_sandbox(resource)
            await self._install_packages(api, sandbox)
            return sandbox
        except BaseException:
            await self._delete_quietly(api, uid)
            raise

    async def _delete_quietly(self, api: _DockerSandboxesAPI, uid: str) -> None:
        try:
            await api.delete_sandbox(uid)
        except Exception:
            logger.warning("Failed to delete Docker sandbox %s", uid, exc_info=True)

    async def _install_packages(self, api: _DockerSandboxesAPI, sandbox: _Sandbox) -> None:
        if not self._packages:
            return
        if self._language == "TYPESCRIPT":
            argv = ["npm", "install", "--no-audit", "--no-fund", *self._packages]
        else:
            argv = ["python3", "-m", "pip", "install", *self._packages]
        token = await api.endpoint_token(sandbox.uid)
        result = await self._exec(
            api, sandbox, token, argv, env=None, timeout=_INSTALL_TIMEOUT_SECONDS
        )
        if result.error is not None:
            tool = "npm" if self._language == "TYPESCRIPT" else "pip"
            raise RuntimeError(f"{tool} install {self._packages!r} failed: {result.error}")

    async def _exec(
        self,
        api: _DockerSandboxesAPI,
        sandbox: _Sandbox,
        token: str,
        argv: Sequence[str],
        *,
        env: Optional[Mapping[str, str]],
        timeout: Optional[int],
    ) -> ExecutionResult:
        # The exec API has no timeout of its own, so the deadline is enforced in the sandbox.
        cmd = list(argv) if timeout is None else ["timeout", "-s", "KILL", str(timeout), *argv]
        http_timeout = None if timeout is None else timeout + _EXEC_HTTP_GRACE_SECONDS
        try:
            response = await api.exec(
                sandbox.endpoint_uri, token, cmd, env=env, timeout=http_timeout
            )
        except httpx.ReadTimeout:
            if timeout is None:
                raise
            return _timed_out(timeout)
        exit_code = int(response.get("exitCode") or 0)
        stdout = _decode(response.get("stdout"))
        stderr = _decode(response.get("stderr"))
        if timeout is not None and exit_code == _TIMEOUT_KILLED_EXIT_CODE:
            return _timed_out(timeout)
        if exit_code != 0:
            return ExecutionResult(
                stdout=stdout, stderr=stderr, error=stderr or f"exit code {exit_code}"
            )
        return ExecutionResult(stdout=stdout, stderr=stderr)

    async def _run(
        self,
        api: _DockerSandboxesAPI,
        sandbox: _Sandbox,
        code: str,
        timeout: Optional[int],
    ) -> ExecutionResult:
        # Evaluator programs embed their inputs and can exceed the Linux argv size limit.
        path = f"{_WORKDIR}/phoenix-{uuid.uuid4().hex}{self._runtime.suffix}"
        token = await api.endpoint_token(sandbox.uid)
        await api.write_file(sandbox.endpoint_uri, token, path, code.encode("utf-8"))
        return await self._exec(
            api,
            sandbox,
            token,
            [*self._runtime.argv, path],
            env=self._user_env,
            timeout=timeout,
        )

    @override
    async def find_or_create_session(self, session_key: str) -> object:
        display_name = self.provider_session_id(session_key)
        async with self._api() as api:
            try:
                existing = await api.list_sandboxes(f"display_name={display_name},status=running")
            except Exception as exc:
                logger.debug(
                    "Docker list failed for key=%r; falling through to create: %s",
                    session_key,
                    exc,
                )
                existing = []
            candidates = [sb for sb in existing if (sb.get("core") or {}).get("endpoint")]
            if candidates:
                oldest = min(candidates, key=lambda sb: (sb["core"]["createdAt"], sb["uid"]))
                return _running_sandbox(oldest)
            return await self._create(api, display_name)

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        sandbox: _Sandbox = handle  # type: ignore[assignment]
        try:
            async with self._api() as api:
                return await self._run(api, sandbox, code, timeout)
        except Exception as exc:
            if self.is_session_gone(exc):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            async with self._api() as api:
                sandbox = await self._create(api, display_name=None)
                try:
                    return await self._run(api, sandbox, code, timeout)
                finally:
                    await self._delete_quietly(api, sandbox.uid)
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close_session(self, session_key: str) -> None:
        display_name = self.provider_session_id(session_key)
        async with self._api() as api:
            try:
                matches = await api.list_sandboxes(f"display_name={display_name}")
            except Exception as exc:
                logger.warning("Docker close_session: list failed for key=%r: %s", session_key, exc)
                return
            for sandbox in matches:
                await self._delete_quietly(api, str(sandbox["uid"]))

    @override
    async def close(self) -> None:
        return None

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        return isinstance(exc, DockerSandboxesError) and exc.status_code == 404


class DockerAdapter(SandboxAdapter[DockerConfig, DockerCredentials, DockerDeployment]):
    backend_type = "DOCKER"
    display_name = "Docker Sandboxes"
    hosting_type = "hosted"
    dependency_hints = (
        "Requires a Docker Agentic Platform subscription.",
        "Provide `DOCKER_ID` and a `DOCKER_PAT` with the `sandbox:use` permission.",
    )
    config_model = DockerConfig
    credentials_model = DockerCredentials
    deployment_config_model = DockerDeployment

    def build_backend(
        self,
        config: DockerConfig,
        *,
        credentials: DockerCredentials,
        deployment: DockerDeployment,
        user_env: Optional[Mapping[str, str]] = None,
        runtime: Optional[SandboxRuntimeContext] = None,
    ) -> SandboxBackend:
        del runtime
        docker_id = credentials.DOCKER_ID.get_secret_value()
        pat = credentials.DOCKER_PAT.get_secret_value()
        if not (docker_id and pat):
            raise ValueError(
                "Docker Sandboxes authentication is not configured. Set DOCKER_ID and "
                "DOCKER_PAT in Settings → Sandboxes → Docker Sandboxes → Credentials, "
                "or as process environment variables."
            )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        deny_internet = config.internet_access is not None and config.internet_access.mode == "deny"
        return DockerSandboxBackend(
            docker_id=SecretStr(docker_id),
            pat=SecretStr(pat),
            language=config.language,
            user_env=user_env,
            packages=packages,
            deny_internet=deny_internet,
        )
