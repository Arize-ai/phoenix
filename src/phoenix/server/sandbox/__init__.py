from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .types import ConfigFieldSpec, EnvVarSpec, ExecutionResult, SandboxAdapter, SandboxBackend

logger = logging.getLogger(__name__)

Decrypt = Callable[[bytes], bytes]


@dataclass(frozen=True)
class SandboxAdapterMeta:
    """Static metadata for a sandbox adapter — always importable, no optional deps."""

    key: str
    label: str
    description: str
    python_packages: list[str]
    env_vars: list[EnvVarSpec]
    config_fields: list[ConfigFieldSpec]
    config_required: bool
    setup_instructions: list[str]


# Static registry of all known adapter types — does NOT require optional packages to be installed.
# All four entries are always present regardless of install state.
SANDBOX_ADAPTER_METADATA: dict[str, SandboxAdapterMeta] = {
    "WASM": SandboxAdapterMeta(
        key="WASM",
        label="WASM (Local)",
        description="Runs code evaluators locally using WebAssembly.",
        python_packages=["wasmtime"],
        env_vars=[],
        config_fields=[],
        config_required=False,
        setup_instructions=['pip install "arize-phoenix[sandbox]"'],
    ),
    "E2B": SandboxAdapterMeta(
        key="E2B",
        label="E2B",
        description="Runs code evaluators in E2B cloud sandboxes.",
        python_packages=["e2b_code_interpreter"],
        env_vars=[EnvVarSpec(name="PHOENIX_SANDBOX_E2B_API_KEY", required=True)],
        config_fields=[ConfigFieldSpec(key="template", label="Template", placeholder="base")],
        config_required=True,
        setup_instructions=[
            "Sign up at e2b.dev and create an API key.",
            "Set PHOENIX_SANDBOX_E2B_API_KEY or configure it below.",
            "pip install e2b-code-interpreter",
        ],
    ),
    "VERCEL": SandboxAdapterMeta(
        key="VERCEL",
        label="Vercel",
        description="Runs code evaluators in Vercel microVM sandboxes.",
        python_packages=["vercel"],
        env_vars=[
            EnvVarSpec(
                name="VERCEL_OIDC_TOKEN",
                required=False,
                description="Auto-populated in Vercel deployments",
            ),
            EnvVarSpec(
                name="PHOENIX_SANDBOX_VERCEL_TOKEN",
                required=False,
                description="Manual token for non-Vercel environments",
            ),
        ],
        config_fields=[
            ConfigFieldSpec(key="runtime", label="Runtime", placeholder="python3.13"),
        ],
        config_required=True,
        setup_instructions=[
            "Set VERCEL_OIDC_TOKEN (auto in Vercel deployments) or PHOENIX_SANDBOX_VERCEL_TOKEN.",
            "pip install vercel",
        ],
    ),
    "DAYTONA": SandboxAdapterMeta(
        key="DAYTONA",
        label="Daytona",
        description="Runs code evaluators in Daytona cloud sandboxes.",
        python_packages=["daytona"],
        env_vars=[EnvVarSpec(name="PHOENIX_SANDBOX_DAYTONA_API_KEY", required=True)],
        config_fields=[],
        config_required=False,
        setup_instructions=[
            "Sign up at daytona.io and create an API key.",
            "Set PHOENIX_SANDBOX_DAYTONA_API_KEY or configure it below.",
            "pip install daytona",
        ],
    ),
}

_SANDBOX_ADAPTERS: dict[str, type[SandboxAdapter]] = {}

_T = TypeVar("_T", bound=SandboxAdapter)


def register_sandbox_adapter(cls: type[_T]) -> type[_T]:
    _SANDBOX_ADAPTERS[cls._key] = cls
    return cls


def get_sandbox_adapters() -> list[tuple[str, type[SandboxAdapter]]]:
    """Returns list of (key, adapter_class) tuples."""
    return list(_SANDBOX_ADAPTERS.items())


async def _resolve_sandbox_credential(
    env_var_name: str,
    session: AsyncSession,
    decrypt: Decrypt,
) -> str | None:
    """Resolve a sandbox backend credential from DB secret or environment variable.

    Two-tier resolution chain:
    1. DB Secret table (encrypted) — looked up by env_var_name as key
    2. Environment variable fallback
    """
    from phoenix.db.models import Secret

    secret = await session.scalar(select(Secret).where(Secret.key == env_var_name))
    if secret is not None:
        return decrypt(secret.value).decode("utf-8")
    return os.getenv(env_var_name)


async def has_credentials(
    adapter_cls: type[SandboxAdapter],
    session: AsyncSession,
    decrypt: Decrypt,
) -> bool:
    """Check if all required credentials are available (DB secrets or env vars)."""
    for var in adapter_cls.env_vars:
        if var.required:
            value = await _resolve_sandbox_credential(var.name, session, decrypt)
            if not value:
                return False
    return True


async def sync_sandbox_adapters(session: AsyncSession) -> None:
    """Ensure one sandbox_configs row exists per known adapter type.

    Iterates SANDBOX_ADAPTER_METADATA (all four adapters, always present)
    so uninstalled adapters still get DB rows and appear in the Settings UI
    with NOT_INSTALLED status. Existing rows are not modified.
    """
    from phoenix.db.models import SandboxConfig

    existing_result = await session.execute(select(SandboxConfig.backend_type))
    existing_types: set[str] = {row[0] for row in existing_result.fetchall()}

    for key in SANDBOX_ADAPTER_METADATA:
        if key not in existing_types:
            session.add(SandboxConfig(backend_type=key))
            logger.info(f"Inserted default sandbox_configs row for {key}")

    await session.flush()


async def sync_sandbox_settings(session: AsyncSession) -> None:
    """Ensure the singleton SandboxSettings row (id=1) exists."""
    from phoenix.db.models import SandboxSettings

    existing = await session.get(SandboxSettings, 1)
    if existing is None:
        session.add(SandboxSettings(id=1))
        logger.info("Inserted default sandbox_settings singleton row")
        await session.flush()


__all__ = [
    "Decrypt",
    "ExecutionResult",
    "SandboxAdapter",
    "SandboxAdapterMeta",
    "SandboxBackend",
    "SANDBOX_ADAPTER_METADATA",
    "get_or_create_backend",
    "get_sandbox_adapters",
    "has_credentials",
    "register_sandbox_adapter",
    "sync_sandbox_adapters",
    "sync_sandbox_settings",
]

try:
    from .wasm_backend import WASMAdapter, WASMBackend  # noqa: F401

    register_sandbox_adapter(WASMAdapter)
    __all__.append("WASMBackend")
except ImportError:
    pass

try:
    from .e2b_backend import E2BAdapter, E2BSandboxBackend  # noqa: F401

    register_sandbox_adapter(E2BAdapter)
    __all__.append("E2BSandboxBackend")
except ImportError:
    pass

try:
    from .vercel_backend import VercelAdapter, VercelSandboxBackend  # noqa: F401

    register_sandbox_adapter(VercelAdapter)
    __all__.append("VercelSandboxBackend")
except ImportError:
    pass

try:
    from .daytona_backend import DaytonaAdapter, DaytonaSandboxBackend  # noqa: F401

    register_sandbox_adapter(DaytonaAdapter)
    __all__.append("DaytonaSandboxBackend")
except ImportError:
    pass


async def get_or_create_backend(
    backend_type: str,
    config: dict[str, Any],
    session: AsyncSession,
    decrypt: Decrypt,
) -> SandboxBackend | None:
    """Create a sandbox backend on demand from adapter registry + caller-supplied config.

    Resolution steps:
    1. Look up adapter class from registry (requires package to be installed)
    2. Resolve credential env vars via two-tier chain (DB secret, then env var)
    3. Call adapter.create_backend(config, resolved_credentials)
    """
    adapter_cls = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter_cls is None:
        logger.debug(f"No adapter registered for backend type '{backend_type}'")
        return None

    adapter = adapter_cls()
    if not adapter.is_installed():
        logger.debug(f"Adapter '{backend_type}' package not installed")
        return None

    resolved_credentials: dict[str, str] = {}
    for var_spec in adapter_cls.env_vars:
        value = await _resolve_sandbox_credential(var_spec.name, session, decrypt)
        if value is not None:
            resolved_credentials[var_spec.name] = value

    try:
        return adapter.create_backend(config, resolved_credentials)
    except Exception:
        logger.warning(f"Failed to create '{backend_type}' sandbox backend", exc_info=True)
        return None
