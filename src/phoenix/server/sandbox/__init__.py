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
    UnsupportedOperation,
)
from phoenix.server.sandbox.types import (
    ProviderCredentialSpec as ProviderCredentialSpec,
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
    """Unified config contract for a sandbox adapter.

    This dataclass is the canonical source of truth for capability advertisement.
    Every consumer — the GQL resolver, the frontend, tests, and adapter
    implementers — reads capability flags from here. New capabilities MUST be
    added here first; per-adapter implementations follow.

    ## Capability naming convention

    - ``bool``: use only for truly binary capabilities that will never grow
      variants (e.g. ``supports_env_vars``).
    - ``Literal['none', 'basic', ...]`` tri-state: use for any capability that
      may later gain modes or levels. The string ``'none'`` always means
      "not supported". The first non-none value names the base supported mode.
    - ``Optional[Literal[...]]``: use when the "supported" value is also a
      meaningful parameter (e.g., ``dependencies_language`` — ``None`` means
      unsupported; a language name means supported *and* specifies which
      language).

    ## Per-capability contracts

    **supports_env_vars** — session-level user-defined environment variables.
    When ``True``, the adapter's ``build_backend`` MUST accept ``user_env``
    (the pre-resolved plaintext name→value dict) and forward it to the
    underlying runtime at constructor time so that every subsequent
    ``execute()`` call sees the variables without a per-call override.
    When ``False``, ``build_backend`` MUST raise ``UnsupportedOperation`` if
    ``user_env`` is non-empty. ``SandboxBackend.execute`` takes only ``code``,
    ``session_key``, and ``timeout`` — there is no per-call env override.

    **internet_access_capability** — controls whether the sandbox can reach
    the internet. ``'none'``: adapter does not support this capability; if the
    stored config contains a non-"none" ``internet_access.mode``,
    ``build_backend`` MUST raise ``UnsupportedOperation``. ``'boolean'``:
    adapter supports a simple allow/deny toggle. ``'allowlist'``: adapter
    supports a per-domain allowlist (reserved for future use; not currently
    user-selectable). Distinct from the runtime ``internet_access`` block on
    SandboxConfig.config, which is the admin/user-authored runtime mode.

    **dependencies_language** — package installation before code execution.
    ``None``: adapter does not support pre-installing dependencies; if the
    stored config contains a non-empty ``dependencies.packages`` list,
    ``build_backend`` MUST raise ``UnsupportedOperation``. A language string
    (``'PYTHON'`` or ``'TYPESCRIPT'``) means the adapter installs packages in
    that ecosystem and MUST execute the install step before running user code.
    """

    display_name: str
    language: str = ""
    dependency_hints: list[str] = field(default_factory=list)
    config_field_specs: list[ConfigFieldSpec] = field(default_factory=list)

    # True/False semantics: True → build_backend MUST accept user_env (the
    # pre-resolved name→value dict) and pass it to the runtime at constructor
    # time; execute() has no per-call env override. False → build_backend MUST
    # raise UnsupportedOperation when user_env is non-empty.
    # UI: True → render the Env Vars editor; False → render a muted
    # "Not supported by the selected backend." placeholder.
    supports_env_vars: bool = False

    # Value semantics: 'none' → capability not supported; build_backend MUST
    # raise UnsupportedOperation when config carries a non-"none"
    # internet_access.mode. 'boolean' → simple allow/deny toggle supported.
    # 'allowlist' → per-domain allowlist reserved for future use; not currently
    # user-selectable via the UI.
    # UI: 'none' → render muted placeholder; 'boolean' → render toggle;
    # 'allowlist' → reserved, do not expose in structured UI or JSON editor.
    # Note: this is the adapter-level capability flag, distinct from the
    # runtime `internet_access` block stored on SandboxConfig.config.
    internet_access_capability: Literal["none", "boolean", "allowlist"] = "none"

    # Value semantics: None → capability not supported; build_backend MUST
    # raise UnsupportedOperation when config carries non-empty
    # dependencies.packages. 'PYTHON'/'TYPESCRIPT' → adapter installs packages
    # in that ecosystem before running user code.
    # UI: None → render muted placeholder; non-None → render the Dependencies
    # editor scoped to the appropriate package ecosystem.
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
        internet_access_capability="none",
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
        internet_access_capability="none",
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
        internet_access_capability="none",
        dependencies_language="PYTHON",
    ),
    # internet_access_capability for both Vercel adapters is shipped as scaffolding
    # only — the flag and UI wiring are in place but runtime enforcement through
    # build_backend is not yet wired. Do not flip to 'boolean' until the Vercel
    # backend honours the internet_access.mode from the stored config.
    "VERCEL_PYTHON": AdapterMetadata(
        display_name="Vercel Sandbox (Python)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`.",
        ],
        supports_env_vars=True,
        internet_access_capability="none",
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
        internet_access_capability="none",
        dependencies_language=None,
    ),
    "DENO": AdapterMetadata(
        display_name="Deno (local)",
        language="TYPESCRIPT",
        dependency_hints=[
            "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
        ],
        supports_env_vars=True,
        internet_access_capability="none",
        dependencies_language=None,
    ),
    "MODAL": AdapterMetadata(
        display_name="Modal",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `modal` extra.",
            "Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables.",
        ],
        supports_env_vars=True,
        internet_access_capability="none",
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
        backend = _BACKEND_CACHE.pop(key, None)
        if backend is None:
            continue
        try:
            await backend.close()
        except Exception:
            logger.warning(f"Error closing sandbox backend {key!r}", exc_info=True)
        evicted += 1
    logger.debug(f"Invalidated {evicted} cache entries for backend_type={backend_type!r}")


async def invalidate_backend_cache_for_key(key: str) -> None:
    """Evict cached backends for every adapter whose credential_specs include `key`.

    Used when a secret value changes (Secret row upserted/deleted) to ensure
    backends holding the pre-rotation plaintext are rebuilt on next access.
    Walks `_SANDBOX_ADAPTERS` and calls `invalidate_backend_cache(backend_type)`
    for each matching adapter. Key comparison is exact against the `key` field
    of each `ProviderCredentialSpec`.

    Broader than `invalidate_backend_cache` because one credential key may be
    shared by multiple backend_types (e.g. VERCEL_TOKEN across VERCEL_PYTHON
    and VERCEL_TYPESCRIPT). A per-adapter eviction failure logs and continues —
    a rotation must not stall because one backend failed to close.
    """
    matched = 0
    for backend_type, adapter in list(_SANDBOX_ADAPTERS.items()):
        if any(spec.key == key for spec in adapter.credential_specs):
            matched += 1
            try:
                await invalidate_backend_cache(backend_type)
            except Exception:
                logger.warning(
                    f"Error invalidating cache for backend_type={backend_type!r} "
                    f"after rotation of {key!r}",
                    exc_info=True,
                )
    logger.debug(f"Invalidated cache across {matched} adapter(s) for key={key!r}")


class MissingSecretError(Exception):
    """Raised when a secret_ref entry references a Secret key that does not exist."""


async def _resolve_user_env(
    raw_env_vars: list[Any],
    session: Optional[AsyncSession],
    decrypt: Optional[Callable[[bytes], bytes]],
) -> dict[str, str]:
    """Parse env_vars list, resolve secret_refs, return plaintext name→value dict.

    Literal entries are resolved unconditionally — they never require DB context.
    Secret refs require both session and decrypt; if either is missing and any
    secret_ref is present, raises MissingSecretError (fail-closed: silent-drop
    would strip user-intended env vars and mislead the caller).

    Raises MissingSecretError if any secret_ref key is absent from the Secret
    table, cannot be decrypted, or if secret_refs are present but no
    session/decrypt context was supplied.
    """
    from pydantic import TypeAdapter

    ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
    entries: list[EnvVarEntry] = [ta.validate_python(e) for e in raw_env_vars]
    # Fail-closed: reject reserved names before any DB lookup so rows persisted
    # before the mutation-layer guard shipped cannot be silently resolved.
    # Mirrors _check_env_var_collision which checks both literal name and secret_key.
    for entry in entries:
        if isinstance(entry, EnvVarLiteral) and is_reserved_credential_name(entry.name):
            raise MissingSecretError(
                f"env_var name {entry.name!r} is a reserved sandbox provider "
                "credential and cannot be used as a user-defined environment variable."
            )
        if isinstance(entry, EnvVarSecretRef) and is_reserved_credential_name(entry.secret_key):
            raise MissingSecretError(
                f"secret_ref.secret_key {entry.secret_key!r} is a reserved sandbox "
                "provider credential and cannot be resolved as a user secret."
            )
    # Collect secret keys that need DB resolution (deduplicated, order-preserving)
    secret_keys: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        if isinstance(entry, EnvVarSecretRef) and entry.secret_key not in seen:
            secret_keys.append(entry.secret_key)
            seen.add(entry.secret_key)

    resolved_secrets: dict[str, str] = {}
    if secret_keys:
        if session is None or decrypt is None:
            # Fail-closed: secret_refs require DB context. Silently dropping
            # them would leave the user-intended env absent at execute() time
            # with no diagnostic.
            raise MissingSecretError(
                "Cannot resolve secret_ref env_vars without a database session "
                "and decrypt context; referenced secret key(s): "
                f"{', '.join(sorted(secret_keys))}"
            )
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
    credential_specs: list[ProviderCredentialSpec],
) -> dict[str, str]:
    """Resolve provider credentials via DB secret lookup + env var fallback.

    For each spec in credential_specs: query the secrets table first, fall back
    to os.getenv(). Keys absent from both tiers are omitted from the result.
    Safe when session or decrypt are None (returns env-only resolution).
    """
    if not credential_specs:
        return {}

    keys = [spec.key for spec in credential_specs]
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
    # Resolved credentials WIN over user-supplied config keys: the server-side
    # DB-secret / env-var value is authoritative, and any reserved-credential
    # key embedded in a user-supplied SandboxConfig.config is defensively
    # overridden here. Reserved-name rejection at the mutation boundary is the
    # primary defense; this factory-level override is defense-in-depth.
    provider_creds = await _resolve_sandbox_credentials(session, decrypt, adapter.credential_specs)
    effective_config: dict[str, Any] = {**(config or {}), **provider_creds}

    cache_key = (backend_type, _config_hash(effective_config))
    if cache_key in _BACKEND_CACHE:
        return _BACKEND_CACHE[cache_key]

    user_env: Optional[dict[str, str]] = None
    raw_env_vars = effective_config.get("env_vars")
    if raw_env_vars:
        # Literal entries resolve unconditionally; secret_refs require DB
        # context and raise MissingSecretError when session/decrypt are absent
        # (fail-closed rather than silent-drop the user-intended env).
        user_env = await _resolve_user_env(raw_env_vars, session, decrypt)

    from pydantic import ValidationError

    try:
        backend = adapter.build_backend(effective_config, user_env=user_env)
        _BACKEND_CACHE[cache_key] = backend
        return backend
    except (MissingSecretError, UnsupportedOperation, ValidationError, ValueError):
        # Fail-closed typed failures that callers MUST surface to users:
        # - MissingSecretError: a referenced Secret key is missing or undecryptable
        # - UnsupportedOperation: adapter capability guard rejected the config
        # - pydantic ValidationError: config shape violated the adapter's schema
        # - ValueError: adapter-level precondition (e.g. Vercel authentication
        #   not configured) — intentionally surfaced, not swallowed
        raise
    except ImportError as exc:
        # Optional adapter dependency missing at backend-construction time.
        # Fall back to None so the caller can render a "not installed" state.
        logger.warning(
            f"Optional dependency unavailable for sandbox backend {backend_type!r}: {exc}",
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


# ---------------------------------------------------------------------------
# Reserved credential names (D2).
#
# Names reserved by sandbox adapters for provider credentials. User-supplied
# env_vars, SandboxConfig top-level keys, and SandboxProvider.config keys
# matching any of these (case-insensitive) are rejected at mutation time so
# they cannot shadow resolved credentials in the factory merge.
#
# Derived from every registered adapter's credential_specs, unioned with the
# Phoenix-level fallback env vars that adapters consult before env lookup.
# Includes the fallbacks explicitly so missing optional extras (e.g. the
# e2b adapter not registered) cannot narrow the reserved set.
# ---------------------------------------------------------------------------

_PHOENIX_RESERVED_CREDENTIAL_ONLY_KEYS: frozenset[str] = frozenset(
    {
        # Reservation-only names: NOT settable via setSandboxCredential mutation.
        # Contrast with SandboxAdapter.credential_specs (adapter-declared, settable
        # via mutation). RESERVED_CREDENTIAL_NAMES is the derived union of both.
        "PHOENIX_SANDBOX_TOKEN",
        "PHOENIX_SANDBOX_API_KEY",
        # Modal tokens — added here so dropping credential_specs from ModalAdapter
        # (task 3) does not silently narrow the reserved set.
        "MODAL_TOKEN_ID",
        "MODAL_TOKEN_SECRET",
    }
)


def _build_reserved_credential_names() -> frozenset[str]:
    names: set[str] = {key.lower() for key in _PHOENIX_RESERVED_CREDENTIAL_ONLY_KEYS}
    for adapter in _SANDBOX_ADAPTERS.values():
        for spec in adapter.credential_specs:
            names.add(spec.key.lower())
    return frozenset(names)


RESERVED_CREDENTIAL_NAMES: frozenset[str] = _build_reserved_credential_names()


def is_reserved_credential_name(name: str) -> bool:
    """Return True if `name` collides with a reserved provider-credential key.

    Comparison is case-insensitive: `VERCEL_TOKEN`, `Vercel_Token`, and
    `vercel_token` are all reserved.
    """
    return name.lower() in RESERVED_CREDENTIAL_NAMES
