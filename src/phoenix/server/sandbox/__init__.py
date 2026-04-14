"""
Sandbox backend registry and factory.

Two tiers:
- SANDBOX_ADAPTER_METADATA: static dict, always present. Maps backend_type key
  to AdapterMetadata (display_name, language). Used for DB seeding
  and UI display regardless of installed optional extras.
- _SANDBOX_ADAPTERS: populated only for installed backends. Maps backend_type
  key to a SandboxAdapter instance. Used for get_or_create_backend().

Importing WASMBackend requires wasmtime — guarded by try/except ImportError.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable, Literal, Optional

from phoenix.server.sandbox.types import (
    ConfigFieldSpec,
    EnvVarEntry,
    EnvVarLiteral,
    EnvVarSecretRef,
    SandboxAdapter,
    SandboxBackend,
)
from phoenix.server.sandbox.types import (
    EnvVarSpec as EnvVarSpec,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# JSON Schema "type" → ConfigFieldSpec.field_type mapping.
_JSON_SCHEMA_TYPE_MAP: dict[str, str] = {
    "string": "string",
    "integer": "integer",
    "number": "integer",
    "boolean": "boolean",
}


def _config_field_specs_from_model(
    model_cls: Any,
) -> list[ConfigFieldSpec]:
    """
    Derive ConfigFieldSpec list from a pydantic model's JSON schema.

    Skips fields not listed in the schema's `properties` (extra="allow" wildcard
    fields are not enumerated). Fields with `enum` become field_type="select".
    Nested-model fields ($ref, array, object types) are silently skipped — they
    are structured config blocks (env_vars, internet_access, dependencies) rendered
    by dedicated UI editors, not flat form fields.
    """
    schema = model_cls.model_json_schema()
    properties: dict[str, Any] = schema.get("properties", {})
    required_keys: set[str] = set(schema.get("required", []))
    specs: list[ConfigFieldSpec] = []
    for key, prop in properties.items():
        # Unwrap anyOf (e.g. Optional[str] → [{type: string}, {type: null}])
        effective_prop = prop
        if "anyOf" in prop:
            non_null = [p for p in prop["anyOf"] if p.get("type") != "null"]
            if non_null:
                effective_prop = non_null[0]

        # Skip nested-model fields: $ref (nested object) or array/object types.
        # These are structured config blocks handled by dedicated UI editors.
        if "$ref" in effective_prop or effective_prop.get("type") in ("array", "object"):
            continue

        if "enum" in effective_prop:
            ft: str = "select"
            choices: Optional[list[str]] = [str(c) for c in effective_prop["enum"]]
        else:
            raw_type = effective_prop.get("type", "string")
            ft = _JSON_SCHEMA_TYPE_MAP.get(raw_type, "string")
            choices = None

        display_name: str = prop.get("title") or key.replace("_", " ").title()
        description: str = prop.get("description") or effective_prop.get("description") or ""

        specs.append(
            ConfigFieldSpec(
                key=key,
                display_name=display_name,
                field_type=ft,  # type: ignore[arg-type]
                required=key in required_keys,
                description=description,
                choices=choices,
            )
        )
    return specs


@dataclass
class AdapterMetadata:
    """Static metadata for a sandbox adapter (no runtime deps)."""

    display_name: str
    language: str = ""
    dependency_hints: list[str] = field(default_factory=list)
    config_field_specs: list[ConfigFieldSpec] = field(default_factory=list)
    supports_env_vars: bool = False
    internet_access: Literal["none", "boolean", "allowlist"] = "none"
    dependencies_language: Optional[Literal["PYTHON", "TYPESCRIPT"]] = None


# ---------------------------------------------------------------------------
# Static metadata — always present regardless of installed extras.
# One entry per (backend_type, language) pair. language must match
# Language.name values seeded to the DB by sync_languages().
# ---------------------------------------------------------------------------
SANDBOX_ADAPTER_METADATA: dict[str, AdapterMetadata] = {
    "WASM": AdapterMetadata(
        display_name="WebAssembly (local)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `wasm` extra so `wasmtime` is available.",
            (
                "Allow Phoenix to download the CPython WASM binary on first use, "
                "or pre-populate the local WASM cache."
            ),
        ],
        supports_env_vars=False,
        internet_access="none",
        dependencies_language=None,
    ),
    "E2B": AdapterMetadata(
        display_name="E2B",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `e2b` extra.",
            "Provide `PHOENIX_SANDBOX_E2B_API_KEY` or `PHOENIX_SANDBOX_API_KEY`.",
        ],
        supports_env_vars=True,
        internet_access="none",
        dependencies_language=None,
    ),
    "DAYTONA_PYTHON": AdapterMetadata(
        display_name="Daytona (Python)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `daytona` extra.",
            "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY` or `PHOENIX_SANDBOX_TOKEN`.",
        ],
        supports_env_vars=True,
        internet_access="none",
        dependencies_language="PYTHON",
    ),
    "VERCEL_PYTHON": AdapterMetadata(
        display_name="Vercel Sandbox (Python)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`.",
        ],
        supports_env_vars=True,
        internet_access="none",
        dependencies_language=None,
    ),
    "VERCEL_TYPESCRIPT": AdapterMetadata(
        display_name="Vercel Sandbox (TypeScript)",
        language="TYPESCRIPT",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`.",
        ],
        supports_env_vars=True,
        internet_access="none",
        dependencies_language=None,
    ),
    "DENO": AdapterMetadata(
        display_name="Deno (local)",
        language="TYPESCRIPT",
        dependency_hints=[
            "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
        ],
        supports_env_vars=True,
        internet_access="none",
        dependencies_language=None,
    ),
    "MODAL": AdapterMetadata(
        display_name="Modal",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `modal` extra.",
            "Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables.",
        ],
        supports_env_vars=False,
        internet_access="none",
        dependencies_language=None,
    ),
}

# ---------------------------------------------------------------------------
# Runtime registry — populated only when the backend's optional deps are
# installed. Modified via register_sandbox_adapter().
# ---------------------------------------------------------------------------
_SANDBOX_ADAPTERS: dict[str, SandboxAdapter] = {}

# ---------------------------------------------------------------------------
# Session cache — (backend_type, config_hash) → SandboxBackend instance.
# ---------------------------------------------------------------------------
_BACKEND_CACHE: dict[tuple[str, str], SandboxBackend] = {}


def _config_hash(config: dict[str, Any] | None) -> str:
    """Return a stable hex digest for a config dict (or empty dict)."""
    canonical = json.dumps(config or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def register_sandbox_adapter(adapter: SandboxAdapter) -> SandboxAdapter:
    """Register a SandboxAdapter in the runtime registry.

    Derives config_field_specs from the adapter's pydantic config_model and
    writes them into SANDBOX_ADAPTER_METADATA so the GQL layer has a single
    authoritative source (no dual-registration).
    """
    _SANDBOX_ADAPTERS[adapter.key] = adapter
    if adapter.key in SANDBOX_ADAPTER_METADATA:
        SANDBOX_ADAPTER_METADATA[adapter.key].config_field_specs = _config_field_specs_from_model(
            adapter.config_model
        )
    logger.debug(f"Registered sandbox adapter: {adapter.key!r}")
    return adapter


async def close_all_backends() -> None:
    """Close all cached SandboxBackend instances and clear the cache."""
    for key, backend in list(_BACKEND_CACHE.items()):
        try:
            await backend.close()
        except Exception:
            logger.warning(f"Error closing sandbox backend {key!r}", exc_info=True)
    _BACKEND_CACHE.clear()


async def invalidate_backend_cache(backend_type: str) -> None:
    """Remove all _BACKEND_CACHE entries for backend_type, closing each backend."""
    evicted = 0
    for key in [k for k in _BACKEND_CACHE if k[0] == backend_type]:
        backend = _BACKEND_CACHE.pop(key)
        try:
            await backend.close()
        except Exception:
            logger.warning(f"Error closing sandbox backend {key!r}", exc_info=True)
        evicted += 1
    logger.debug(f"Invalidated {evicted} cache entries for backend_type={backend_type!r}")


class MissingSecretError(Exception):
    """Raised when a secret_ref entry references a Secret key that does not exist."""


async def _resolve_user_env(
    raw_env_vars: list[Any],
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> dict[str, str]:
    """Parse env_vars list, resolve secret_refs, return plaintext name→value dict.

    Raises MissingSecretError if any secret_ref key is absent from the Secret table.
    """
    from pydantic import TypeAdapter

    ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
    entries: list[EnvVarEntry] = [ta.validate_python(e) for e in raw_env_vars]
    # Collect secret keys that need DB resolution (deduplicated, order-preserving)
    secret_keys: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        if isinstance(entry, EnvVarSecretRef) and entry.secret_key not in seen:
            secret_keys.append(entry.secret_key)
            seen.add(entry.secret_key)

    resolved_secrets: dict[str, str] = {}
    if secret_keys:
        import sqlalchemy as sa

        from phoenix.db import models

        rows = (
            await session.scalars(
                sa.select(models.Secret).where(models.Secret.key.in_(secret_keys))
            )
        ).all()
        found_keys = set()
        for row in rows:
            try:
                resolved_secrets[row.key] = decrypt(row.value).decode("utf-8")
                found_keys.add(row.key)
            except Exception:
                raise MissingSecretError(f"Secret '{row.key}' exists but could not be decrypted")
        missing = set(secret_keys) - found_keys
        if missing:
            raise MissingSecretError(
                f"Referenced secret key(s) not found: {', '.join(sorted(missing))}"
            )

    user_env: dict[str, str] = {}
    for entry in entries:
        if isinstance(entry, EnvVarLiteral):
            user_env[entry.name] = entry.value
        else:
            assert isinstance(entry, EnvVarSecretRef)
            user_env[entry.name] = resolved_secrets[entry.secret_key]
    return user_env


async def _resolve_sandbox_credentials(
    session: Optional[AsyncSession],
    decrypt: Optional[Callable[[bytes], bytes]],
    env_var_specs: list[EnvVarSpec],
) -> dict[str, str]:
    """Resolve provider credentials via DB secret lookup + env var fallback.

    For each spec in env_var_specs: query the secrets table first, fall back
    to os.getenv(). Keys absent from both tiers are omitted from the result.
    Safe when session or decrypt are None (returns env-only resolution).
    """
    if not env_var_specs:
        return {}

    keys = [spec.key for spec in env_var_specs]
    db_secrets: dict[str, str] = {}

    if session is not None and decrypt is not None:
        import sqlalchemy as sa

        from phoenix.db import models

        rows = (
            await session.scalars(sa.select(models.Secret).where(models.Secret.key.in_(keys)))
        ).all()
        for row in rows:
            try:
                db_secrets[row.key] = decrypt(row.value).decode("utf-8")
            except Exception:
                logger.warning(f"Failed to decrypt sandbox credential {row.key!r}", exc_info=True)

    result: dict[str, str] = {}
    for key in keys:
        if key in db_secrets:
            result[key] = db_secrets[key]
        else:
            env_val = os.getenv(key)
            if env_val:
                result[key] = env_val
    return result


async def get_or_create_backend(
    backend_type: str,
    config: dict[str, Any] | None = None,
    session: Optional[AsyncSession] = None,
    decrypt: Optional[Callable[[bytes], bytes]] = None,
) -> Optional[SandboxBackend]:
    """
    Return a cached SandboxBackend for backend_type, creating it if needed.

    If config contains an `env_vars` list and session+decrypt are provided,
    secret_ref entries are resolved and the plaintext dict is passed to
    build_backend as user_env (NOT merged into config).

    Raises MissingSecretError if a secret_ref references a missing Secret key.

    Returns None if:
    - No adapter is registered for backend_type (optional dep not installed)
    - Backend construction fails (non-secret errors are caught and logged)
    """
    adapter = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        logger.debug(
            f"No adapter registered for backend_type={backend_type!r}; "
            "optional dependency may not be installed"
        )
        return None

    # Resolve provider credentials (DB secret → env var fallback) and merge
    # them into a shallow copy of config so adapters see them via config.get().
    # User-supplied config keys take precedence over resolved credentials.
    provider_creds = await _resolve_sandbox_credentials(session, decrypt, adapter.env_var_specs)
    effective_config: dict[str, Any] = {**provider_creds, **(config or {})}

    cache_key = (backend_type, _config_hash(effective_config))
    if cache_key in _BACKEND_CACHE:
        return _BACKEND_CACHE[cache_key]

    user_env: Optional[dict[str, str]] = None
    raw_env_vars = effective_config.get("env_vars")
    if raw_env_vars and session is not None and decrypt is not None:
        user_env = await _resolve_user_env(raw_env_vars, session, decrypt)

    try:
        backend = adapter.build_backend(effective_config, user_env=user_env)
        _BACKEND_CACHE[cache_key] = backend
        return backend
    except MissingSecretError:
        raise
    except Exception as exc:
        logger.warning(
            f"Failed to create sandbox backend for {backend_type!r}: {exc}",
            exc_info=True,
        )
        return None


# ---------------------------------------------------------------------------
# Register built-in adapters (guarded by try/except for optional deps).
# ---------------------------------------------------------------------------

try:
    from phoenix.server.sandbox.wasm_backend import WASMAdapter

    register_sandbox_adapter(WASMAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.e2b_backend import E2BAdapter

    register_sandbox_adapter(E2BAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.daytona_backend import DaytonaPythonAdapter

    register_sandbox_adapter(DaytonaPythonAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.vercel_backend import VercelPythonAdapter, VercelTypescriptAdapter

    register_sandbox_adapter(VercelPythonAdapter())
    register_sandbox_adapter(VercelTypescriptAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.deno_backend import DenoAdapter

    register_sandbox_adapter(DenoAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.modal_backend import ModalAdapter

    register_sandbox_adapter(ModalAdapter())
except ImportError:
    pass
