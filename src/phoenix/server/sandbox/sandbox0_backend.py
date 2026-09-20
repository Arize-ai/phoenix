"""Sandbox0 evaluator runtime using the SDK's asynchronous generated API.

Sessions belong to one backend/replica. Sandbox0 has no list-by-metadata API;
we never discover or delete unrelated sandboxes in the team. A hard TTL bounds
orphan lifetimes after Phoenix crashes. Every execution uses a fresh CMD process.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, AsyncIterator, ClassVar, Mapping, Optional

from .types import (
    ExecutionResult,
    Sandbox0Config,
    Sandbox0Credentials,
    Sandbox0Deployment,
    SandboxAdapter,
    SandboxBackend,
    SandboxRuntimeContext,
    compose_secret_values,
    compute_config_fingerprint,
)

if TYPE_CHECKING:
    from sandbox0.apispec.client import AuthenticatedClient
    from sandbox0.apispec.models.context_response import ContextResponse

logger = logging.getLogger(__name__)
_SESSION_TTL = 3600
_DEFAULT_TIMEOUT = 300


class _SandboxGone(Exception):
    """A sandbox lookup confirmed that the remote session no longer exists."""


class Sandbox0SandboxBackend(SandboxBackend):
    """Reuse isolated machines while keeping each evaluation's globals independent."""

    provider: ClassVar[str] = "SANDBOX0"

    def __init__(
        self,
        config: Sandbox0Config,
        credentials: Sandbox0Credentials,
        deployment: Sandbox0Deployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> None:
        self._config = config
        self._credentials = credentials
        # Validate env fallbacks with the same rules as persisted deployment settings.
        self._deployment = Sandbox0Deployment(
            api_url=deployment.api_url
            or os.getenv("SANDBOX0_API_URL")
            or "https://api.sandbox0.ai",
            template=deployment.template
            or ("coding-agent" if config.language == "TYPESCRIPT" else "default"),
        )
        self._user_env = dict(user_env or {})
        self.secret_values = compose_secret_values(user_env, credentials.SANDBOX0_API_KEY)
        self._sessions: dict[str, str] = {}

    def config_fingerprint(self) -> str:
        config = self._config
        runtime_digest = compute_config_fingerprint(
            backend_type=self.provider,
            packages=config.dependencies.packages if config.dependencies else (),
            internet_access_mode=config.internet_access.mode if config.internet_access else None,
            language=config.language,
        )
        # Changing the endpoint/template must not reuse the previous deployment's handle.
        payload = json.dumps([runtime_digest, self._deployment.model_dump()], sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    @asynccontextmanager
    async def _client(self, timeout: float = 30) -> AsyncIterator[AuthenticatedClient]:
        from sandbox0 import Client

        client = Client(
            token=self._credentials.SANDBOX0_API_KEY.get_secret_value(),
            base_url=self._deployment.api_url or "https://api.sandbox0.ai",
            timeout=timeout,
        )
        try:
            yield client.api
        finally:
            await client.api.get_async_httpx_client().aclose()
            client.close()

    async def _delete(self, sandbox_id: str) -> None:
        from sandbox0.apispec.api.sandboxes import delete_api_v1_sandboxes_id
        from sandbox0.apispec.models.success_message_response import SuccessMessageResponse
        from sandbox0.response import ensure_model

        async with self._client() as client:
            response = await delete_api_v1_sandboxes_id.asyncio_detailed(sandbox_id, client=client)
            if response.status_code != 404:
                ensure_model(response, SuccessMessageResponse)

    async def _create(self) -> str:
        from sandbox0.apispec.api.sandboxes import post_api_v1_sandboxes
        from sandbox0.apispec.models.claim_request import ClaimRequest
        from sandbox0.apispec.models.sandbox_config import SandboxConfig
        from sandbox0.apispec.models.sandbox_network_policy import SandboxNetworkPolicy
        from sandbox0.apispec.models.sandbox_network_policy_mode import SandboxNetworkPolicyMode
        from sandbox0.apispec.models.success_claim_response import SuccessClaimResponse
        from sandbox0.response import ensure_data

        deny = (
            self._config.internet_access is not None and self._config.internet_access.mode == "deny"
        )
        request = ClaimRequest(
            template=self._deployment.template or "default",
            config=SandboxConfig(
                ttl=_SESSION_TTL,
                hard_ttl=_SESSION_TTL,
                auto_resume=False,
                network=SandboxNetworkPolicy(
                    mode=SandboxNetworkPolicyMode.BLOCK_ALL
                    if deny
                    else SandboxNetworkPolicyMode.ALLOW_ALL
                ),
            ),
        )
        async with self._client(120) as client:
            response = await post_api_v1_sandboxes.asyncio_detailed(client=client, body=request)
            sandbox_id: str = ensure_data(response, SuccessClaimResponse).sandbox_id
        try:
            packages = self._config.dependencies.packages if self._config.dependencies else []
            if packages:
                command = (
                    [
                        "python3",
                        "-m",
                        "pip",
                        "install",
                        "--target",
                        "/workspace/.phoenix-python",
                        "--upgrade",
                        "--",
                        *packages,
                    ]
                    if self._config.language == "PYTHON"
                    else ["npm", "install", "--no-audit", "--no-fund", "--", *packages]
                )
                result = await self._run_command(sandbox_id, command, _DEFAULT_TIMEOUT, env={})
                if not result.success:
                    raise RuntimeError(f"Sandbox0 dependency installation failed: {result.error}")
            return sandbox_id
        except BaseException:
            await self._delete(sandbox_id)
            raise

    async def _create_owned(self) -> str:
        # Do not lose the ID if cancellation arrives while the claim is committing.
        # Finish the bounded claim, clean it up, then propagate cancellation.
        task = asyncio.create_task(self._create())
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            try:
                sandbox_id = await task
                await self._delete(sandbox_id)
            except Exception:
                logger.warning("Failed to clean up cancelled Sandbox0 creation", exc_info=True)
            raise

    async def find_or_create_session(self, session_key: str) -> object:
        from sandbox0.apispec.api.sandboxes import get_api_v1_sandboxes_id
        from sandbox0.apispec.models.success_sandbox_response import SuccessSandboxResponse
        from sandbox0.response import ensure_data

        sandbox_id = self._sessions.get(session_key)
        if sandbox_id is not None:
            async with self._client() as client:
                response = await get_api_v1_sandboxes_id.asyncio_detailed(sandbox_id, client=client)
                if response.status_code != 404:
                    sandbox = ensure_data(response, SuccessSandboxResponse)
                    if sandbox.status == "running":
                        return sandbox_id
                    await self._delete(sandbox_id)
            self._sessions.pop(session_key, None)
        sandbox_id = await self._create_owned()
        self._sessions[session_key] = sandbox_id
        return sandbox_id

    async def _run_command(
        self, sandbox_id: str, command: list[str], timeout: int, *, env: Mapping[str, str]
    ) -> ExecutionResult:
        from sandbox0.apispec.api.contexts import (
            delete_api_v1_sandboxes_id_contexts_ctx_id as delete_context,
        )
        from sandbox0.apispec.api.contexts import (
            get_api_v1_sandboxes_id_contexts_ctx_id as get_context,
        )
        from sandbox0.apispec.api.contexts import (
            post_api_v1_sandboxes_id_contexts as create_context,
        )
        from sandbox0.apispec.models.create_cmd_context_request import CreateCMDContextRequest
        from sandbox0.apispec.models.create_context_request import CreateContextRequest
        from sandbox0.apispec.models.create_context_request_env_vars import (
            CreateContextRequestEnvVars,
        )
        from sandbox0.apispec.models.process_type import ProcessType
        from sandbox0.apispec.models.success_context_response import SuccessContextResponse
        from sandbox0.apispec.models.success_deleted_response import SuccessDeletedResponse
        from sandbox0.response import ensure_data, ensure_model

        request = CreateContextRequest(
            type_=ProcessType.CMD,
            cmd=CreateCMDContextRequest(command=command),
            cwd="/workspace",
            env_vars=CreateContextRequestEnvVars.from_dict(dict(env)),
            wait_until_done=False,
            ttl_sec=timeout,
            idle_timeout_sec=timeout,
        )
        async with self._client() as client:
            context = None
            create_task = asyncio.create_task(
                create_context.asyncio_detailed(sandbox_id, client=client, body=request)
            )
            try:
                response = await asyncio.shield(create_task)
                context = ensure_data(response, SuccessContextResponse)

                async def wait(current: ContextResponse) -> ExecutionResult:
                    while current.running:
                        await asyncio.sleep(0.1)
                        response = await get_context.asyncio_detailed(
                            sandbox_id, current.id, client=client
                        )
                        current = ensure_data(response, SuccessContextResponse)
                    stdout = current.stdout if isinstance(current.stdout, str) else ""
                    stderr = current.stderr if isinstance(current.stderr, str) else ""
                    error = (
                        None
                        if current.exit_code == 0
                        else stderr or "Sandbox0 command did not exit successfully"
                    )
                    return ExecutionResult(stdout=stdout, stderr=stderr, error=error)

                return await asyncio.wait_for(wait(context), timeout=timeout)
            finally:
                # A cancelled HTTP await must not leave an untracked process behind.
                if context is None:
                    try:
                        context = ensure_data(await create_task, SuccessContextResponse)
                    except Exception:
                        pass
                if context is not None:
                    deleted = await delete_context.asyncio_detailed(
                        sandbox_id, context.id, client=client
                    )
                    if deleted.status_code != 404:
                        ensure_model(deleted, SuccessDeletedResponse)

    async def execute_in_session(
        self, handle: object, code: str, timeout: Optional[int] = None
    ) -> ExecutionResult:
        command = (
            ["python3", "-c", code]
            if self._config.language == "PYTHON"
            else ["node", "--input-type=module-typescript", "-e", code]
        )
        env = dict(self._user_env)
        if (
            self._config.language == "PYTHON"
            and self._config.dependencies
            and self._config.dependencies.packages
        ):
            # --target avoids modifying an externally managed system Python.
            # Keep template packages available and prefer this config's dependencies.
            env["PYTHONPATH"] = "/workspace/.phoenix-python" + (
                ":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
            )
        try:
            return await self._run_command(
                str(handle),
                command,
                timeout if timeout is not None else _DEFAULT_TIMEOUT,
                env=env,
            )
        except Exception as exc:
            from sandbox0.errors import APIError

            if isinstance(exc, APIError) and exc.status_code == 404:
                # The SDK's generated endpoints do not all parse 404 envelopes.
                # Confirm sandbox absence instead of mistaking a missing context
                # for a lost sandbox and replaying user code unnecessarily.
                from sandbox0.apispec.api.sandboxes import get_api_v1_sandboxes_id
                from sandbox0.apispec.models.success_sandbox_response import SuccessSandboxResponse
                from sandbox0.response import ensure_data

                async with self._client() as client:
                    response = await get_api_v1_sandboxes_id.asyncio_detailed(
                        str(handle), client=client
                    )
                    if response.status_code == 404:
                        raise _SandboxGone("Sandbox0 session no longer exists") from exc
                    ensure_data(response, SuccessSandboxResponse)
            if self.is_session_gone(exc) or isinstance(exc, asyncio.TimeoutError):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def execute(
        self, code: str, session_key: str, timeout: Optional[int] = None
    ) -> ExecutionResult:
        sandbox_id = await self._create_owned()
        try:
            return await self.execute_in_session(sandbox_id, code, timeout)
        finally:
            await self._delete(sandbox_id)

    async def close_session(self, session_key: str) -> None:
        sandbox_id = self._sessions.get(session_key)
        if sandbox_id is not None:
            await self._delete(sandbox_id)
            self._sessions.pop(session_key, None)

    async def close(self) -> None:
        # Live sessions are owned by SandboxSessionManager, not a request's backend.
        return None

    def is_session_gone(self, exc: BaseException) -> bool:
        return isinstance(exc, _SandboxGone)


class Sandbox0Adapter(SandboxAdapter[Sandbox0Config, Sandbox0Credentials, Sandbox0Deployment]):
    backend_type = "SANDBOX0"
    display_name = "Sandbox0"
    hosting_type = "hosted"
    config_model = Sandbox0Config
    credentials_model = Sandbox0Credentials
    deployment_config_model = Sandbox0Deployment
    dependency_hints = (
        "Install `arize-phoenix[sandbox0]`.",
        "Provide `SANDBOX0_API_KEY`.",
    )

    @classmethod
    def probe_dependencies(cls) -> None:
        import sandbox0  # noqa: F401

    def build_backend(
        self,
        config: Sandbox0Config,
        *,
        credentials: Sandbox0Credentials,
        deployment: Sandbox0Deployment,
        user_env: Optional[Mapping[str, str]] = None,
        runtime: Optional[SandboxRuntimeContext] = None,
    ) -> SandboxBackend:
        self.probe_dependencies()
        return Sandbox0SandboxBackend(config, credentials, deployment, user_env)
