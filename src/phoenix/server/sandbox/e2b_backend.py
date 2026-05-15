"""
E2B sandbox backend.

Requires the ``e2b_code_interpreter`` package (optional extra). Imports of the
SDK are lazy (in ``E2BSandboxBackend._get_sandbox_cls``) so the module remains
importable when the extra is absent. Adapter availability is gated by
``E2BAdapter.probe_dependencies`` at registration time, which surfaces a
missing extra as ``status=NOT_INSTALLED`` instead of a runtime error.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from starlette.datastructures import Secret

from ._text import strip_ansi, strip_ansi_optional
from .types import (
    E2BConfig,
    ExecutionResult,
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

if TYPE_CHECKING:
    from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
    from e2b_code_interpreter.models import Execution

logger = logging.getLogger(__name__)

ENV_E2B_API_KEY = "E2B_API_KEY"


class E2BSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in E2B cloud sandboxes.

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.
    """

    def __init__(
        self,
        api_key: Secret,
        template: Optional[str] = None,
        metadata: Optional[str] = None,
        user_env: Optional[Mapping[str, str]] = None,
        allow_internet_access: bool = True,
        packages: Optional[Sequence[str]] = None,
    ) -> None:
        self._api_key = api_key
        # ``template=None`` lets ``AsyncSandbox.create()`` fall back to its
        # ``default_template`` (``code-interpreter-v1``), which is the only
        # image that runs the Jupyter server ``run_code()`` POSTs to on
        # ``JUPYTER_PORT`` (49999). The previously hard-coded ``"base"`` template
        # is the generic E2B image and does NOT run Jupyter, so every call
        # surfaced as ``502 The sandbox is running but port is not open``.
        self._template = template
        self._metadata = metadata
        self._user_env: dict[str, str] = dict(user_env or {})
        self._allow_internet_access = allow_internet_access
        self._packages: list[str] = list(packages) if packages else []
        self._sessions: dict[str, AsyncSandbox] = {}
        self.secret_values = compose_secret_values(user_env, self._api_key)

    def _get_sandbox_cls(self) -> type[AsyncSandbox]:
        from e2b_code_interpreter.code_interpreter_async import AsyncSandbox

        return AsyncSandbox

    def _create_kwargs(self) -> dict[str, Any]:
        """Build kwargs for AsyncSandbox.create().

        The E2B SDK expects metadata as Dict[str, str]. A string value from
        the config is passed under the key ``"info"``, so the sandbox is
        tagged with ``{"info": "<value>"}``. ``api_key`` is forwarded via the
        SDK's ``ApiParams`` (``**opts``) on ``create()``.
        """
        kwargs: dict[str, Any] = {
            "api_key": str(self._api_key),
            "allow_internet_access": self._allow_internet_access,
        }
        if self._template is not None:
            kwargs["template"] = self._template
        if self._metadata is not None:
            kwargs["metadata"] = {"info": self._metadata}
        return kwargs

    async def _install_packages(self, sandbox: AsyncSandbox) -> None:
        """pip-install configured packages via run_code.

        ``{self._packages!r}`` serializes the list as a Python list literal
        with each spec wrapped in correctly escaped string quotes. ``shlex.quote``
        must NOT be used here: the generated code calls ``subprocess.run`` with
        a list (no shell), so any shell-style quoting becomes part of the argv
        element and pip rejects e.g. ``'numpy>=1.0'`` as an invalid name.
        """
        if not self._packages:
            return
        install_code = (
            "import subprocess, sys\n"
            "r = subprocess.run(\n"
            f"    [sys.executable, '-m', 'pip', 'install', *{self._packages!r}],\n"
            "    capture_output=True, text=True\n"
            ")\n"
            "if r.returncode != 0:\n"
            "    raise RuntimeError(r.stderr)\n"
        )
        execution = await sandbox.run_code(install_code)
        if execution.error:
            raise RuntimeError(f"pip install failed for {self._packages!r}: {execution.error}")

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"E2B session '{session_key}' already exists; reusing")
            return
        sandbox_cls = self._get_sandbox_cls()
        sandbox = await sandbox_cls.create(**self._create_kwargs())
        await self._install_packages(sandbox)
        self._sessions[session_key] = sandbox
        logger.debug(f"Started E2B session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            await sandbox.kill()
            logger.debug(f"Stopped E2B session '{session_key}'")

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            sandbox = self._sessions.get(session_key)
            execution: Execution
            if sandbox is not None:
                execution = await sandbox.run_code(
                    code,
                    envs=self._user_env or None,
                    timeout=timeout,
                )
            else:
                # Ephemeral: spin up a fresh sandbox, run, then close.
                # The evaluator path enters via execute() without ever calling
                # start_session(), so configured dependencies.packages must be
                # installed here too — otherwise they're silently dropped (the
                # only other install site is start_session). Mirrors the
                # Daytona ephemeral branch.
                sandbox_cls = self._get_sandbox_cls()
                async with await sandbox_cls.create(**self._create_kwargs()) as sb:
                    await self._install_packages(sb)
                    execution = await sb.run_code(
                        code,
                        envs=self._user_env or None,
                        timeout=timeout,
                    )

            stdout = "\n".join(execution.logs.stdout) if execution.logs.stdout else ""
            stderr = "\n".join(execution.logs.stderr) if execution.logs.stderr else ""
            error_str: Optional[str] = str(execution.error) if execution.error else None

            return ExecutionResult(
                stdout=strip_ansi(stdout),
                stderr=strip_ansi(stderr),
                error=strip_ansi_optional(error_str),
            )
        except Exception as exc:
            return ExecutionResult(
                stdout="",
                stderr=strip_ansi(str(exc)),
                error=strip_ansi(str(exc)),
            )

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class E2BAdapter(SandboxAdapter):
    key = "E2B"
    family = "E2B"
    display_name = "E2B"
    language = "PYTHON"
    config_model = E2BConfig
    credential_specs = [
        ProviderCredentialSpec(
            key=ENV_E2B_API_KEY,
            display_name="E2B API Key",
            description="API key for the E2B sandbox service.",
        ),
    ]

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify ``e2b_code_interpreter`` is installed; ImportError → NOT_INSTALLED."""
        import e2b_code_interpreter  # noqa: F401

    def build_backend(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        # Fail-closed on missing credential. Passing an empty api_key would let
        # the E2B SDK silently fall back to ``os.getenv("E2B_API_KEY")``
        # (e2b.connection_config:94). Phoenix's resolver already consults that
        # env var, so reaching this branch with an empty key means Phoenix
        # decided "no credential available"; raise rather than let the SDK
        # auto-discover and bypass that decision.
        api_key: str = config.get(ENV_E2B_API_KEY) or ""
        if not api_key:
            raise ValueError(
                "E2B sandbox authentication is not configured. Set "
                "E2B_API_KEY via setSandboxCredential or as a "
                "process environment variable."
            )
        internet_access = config.get("internet_access")
        if internet_access is not None:
            mode = (
                internet_access.get("mode")
                if isinstance(internet_access, dict)
                else getattr(internet_access, "mode", None)
            )
            allow_internet_access = mode != "deny"
        else:
            allow_internet_access = True
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        return E2BSandboxBackend(
            api_key=Secret(api_key),
            template=None,
            metadata=None,
            user_env=user_env,
            allow_internet_access=allow_internet_access,
            packages=packages or None,
        )
