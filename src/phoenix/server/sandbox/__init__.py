"""
Sandbox backend registry and factory.

Two tiers:
- SANDBOX_ADAPTER_METADATA: static dict, always present. Maps backend_type key
  to AdapterMetadata (display_name, language). Used for DB seeding
  and UI display regardless of installed optional extras.
- _SANDBOX_ADAPTERS: populated only for installed backends. Maps backend_type
  key to a SandboxAdapter instance. Used for build_sandbox_backend().

Adapter modules with optional SDK extras (wasmtime, e2b, daytona, vercel,
modal) keep their SDK imports lazy so the modules remain importable in test
environments where the extra is absent. Availability is gated at registration
time by ``Adapter.probe_dependencies()``: each adapter overrides the classmethod
to import its SDK; the registration block below wraps adapter import + probe +
register in a single ``try/except ImportError``. A missing extra → adapter
absent from ``_SANDBOX_ADAPTERS`` → status resolver maps to ``NOT_INSTALLED``
(surfacing the adapter's dependency hints in the UI).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Iterator,
    Literal,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
)

from phoenix.config import get_env_allowed_sandbox_providers
from phoenix.server.sandbox.types import (
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

    # Where the sandbox's code execution physically happens.
    # 'local' → the runtime executes on the same machine as the Phoenix
    # server (sandboxed, but consuming Phoenix's CPU/memory; e.g. WASM, Deno).
    # 'hosted' → execution is delegated to an external provider over the
    # network (e.g. E2B, Daytona, Vercel, Modal); Phoenix only orchestrates.
    # UI: rendered as a "Local" / "Hosted" badge on the providers table with a
    # tooltip explaining the resource trade-off.
    hosting_type: Literal["local", "hosted"] = "hosted"

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

    # Distinguishes WHEN package install runs relative to the sandbox network
    # policy. ``True`` → install runs INSIDE the created sandbox via run_code
    # (e.g. E2B, Daytona). If the sandbox is created with internet denied, pip
    # cannot reach PyPI and the install fails silently — so the combination
    # ``internet_access.mode == "deny"`` + non-empty ``dependencies.packages``
    # MUST be rejected at validate_config time. ``False`` → install runs at
    # image-build time, before the sandbox (and any network policy) exists
    # (e.g. Modal's ``image.pip_install``); the combo is safe. Adapters that
    # don't support dependencies at all (``dependencies_language is None``)
    # ignore this flag because the no-deps gate already rejects packages.
    installs_packages_at_runtime: bool = False


# ---------------------------------------------------------------------------
# Static metadata — always present regardless of installed extras.
# One entry per (backend_type, language) pair. language must match
# Language.name values seeded to the DB by sync_languages().
# ---------------------------------------------------------------------------
SANDBOX_ADAPTER_METADATA: dict[str, AdapterMetadata] = {
    "WASM": AdapterMetadata(
        display_name="WebAssembly",
        language="PYTHON",
        hosting_type="local",
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
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `e2b` extra.",
            "Provide `E2B_API_KEY`.",
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="PYTHON",
        installs_packages_at_runtime=True,
    ),
    "DAYTONA_PYTHON": AdapterMetadata(
        display_name="Daytona",
        language="PYTHON",
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `daytona` extra.",
            "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY`.",
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="PYTHON",
        installs_packages_at_runtime=True,
    ),
    "DAYTONA_TYPESCRIPT": AdapterMetadata(
        display_name="Daytona",
        language="TYPESCRIPT",
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `daytona` extra.",
            "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY`.",
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="TYPESCRIPT",
        installs_packages_at_runtime=True,
    ),
    # Vercel Python SDK checked: pyproject minimum vercel>=0.5.8; uv.lock resolves
    # vercel==0.5.8. Runtime dependency install is wired via `_install_packages`
    # in VercelSandboxBackend: PYTHON → `python3 -m pip install --user <pkgs>`,
    # TYPESCRIPT → `npm install <pkgs>`. AsyncSandbox.create() in 0.5.8 accepts a
    # `network_policy` kwarg — VercelSandboxBackend maps internet_access.mode
    # to "allow-all" / "deny-all" string forms. internet_access_capability is
    # "boolean"; the runtime-install + network-deny interlock at types.py:688 /
    # :812 now rejects deny + non-empty dependencies.packages eagerly.
    "VERCEL_PYTHON": AdapterMetadata(
        display_name="Vercel",
        language="PYTHON",
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            (
                "Set all of `VERCEL_TOKEN`, "
                "`VERCEL_PROJECT_ID`, and "
                "`VERCEL_TEAM_ID`. See "
                "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
            ),
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="PYTHON",
        installs_packages_at_runtime=True,
    ),
    "VERCEL_TYPESCRIPT": AdapterMetadata(
        display_name="Vercel",
        language="TYPESCRIPT",
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            (
                "Set all of `VERCEL_TOKEN`, "
                "`VERCEL_PROJECT_ID`, and "
                "`VERCEL_TEAM_ID`. See "
                "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
            ),
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="TYPESCRIPT",
        installs_packages_at_runtime=True,
    ),
    "DENO": AdapterMetadata(
        display_name="Deno",
        language="TYPESCRIPT",
        hosting_type="local",
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
        hosting_type="hosted",
        dependency_hints=[
            "Install Phoenix with the `modal` extra.",
            ("Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables."),
        ],
        supports_env_vars=True,
        internet_access_capability="boolean",
        dependencies_language="PYTHON",
    ),
}

# ---------------------------------------------------------------------------
# Runtime registry — populated only when the backend's optional deps are
# installed. Modified via register_sandbox_adapter().
# ---------------------------------------------------------------------------


class _AllowlistGatedAdapterRegistry(MutableMapping[str, SandboxAdapter]):
    """Registry of sandbox adapters with read-time allowlist filtering.

    Storage is delegated to an internal dict. Reads consult
    PHOENIX_ALLOWED_SANDBOX_PROVIDERS via ``get_env_allowed_sandbox_providers()``
    and skip adapters whose ``family`` is not in the allowed set. Writes
    are unfiltered — registration at import time should always succeed;
    the gate filters who can reach the value afterward.

    Disallowed keys appear absent: ``__getitem__`` raises KeyError,
    ``.get()`` returns the default, ``in`` returns False, and iteration /
    len / keys / values / items skip them.
    """

    def __init__(self) -> None:
        self._adapters: dict[str, SandboxAdapter] = {}

    @staticmethod
    def _allowed(adapter: SandboxAdapter) -> bool:
        return adapter.family in get_env_allowed_sandbox_providers()

    def __getitem__(self, key: str) -> SandboxAdapter:
        adapter = self._adapters[key]
        if not self._allowed(adapter):
            raise KeyError(key)
        return adapter

    def __setitem__(self, key: str, value: SandboxAdapter) -> None:
        self._adapters[key] = value

    def __delitem__(self, key: str) -> None:
        del self._adapters[key]

    def __iter__(self) -> Iterator[str]:
        allowed = get_env_allowed_sandbox_providers()
        return (k for k, v in self._adapters.items() if v.family in allowed)

    def __len__(self) -> int:
        allowed = get_env_allowed_sandbox_providers()
        return sum(1 for v in self._adapters.values() if v.family in allowed)


_SANDBOX_ADAPTERS: MutableMapping[str, SandboxAdapter] = _AllowlistGatedAdapterRegistry()


def register_sandbox_adapter(adapter: SandboxAdapter) -> SandboxAdapter:
    """Register a SandboxAdapter in the runtime registry."""
    _SANDBOX_ADAPTERS[adapter.key] = adapter
    logger.debug(f"Registered sandbox adapter: {adapter.key!r}")
    return adapter


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


async def _resolve_named_credentials(
    session: Optional[AsyncSession],
    decrypt: Optional[Callable[[bytes], bytes]],
    keys: Sequence[str | ProviderCredentialSpec],
) -> dict[str, str]:
    """Resolve credential specs via DB then process env."""
    if not keys:
        return {}

    credential_specs = [
        key
        if isinstance(key, ProviderCredentialSpec)
        else ProviderCredentialSpec(key=key, display_name=key)
        for key in keys
    ]
    deduped_specs = list({spec.key: spec for spec in credential_specs}.values())
    lookup_keys = [spec.key for spec in deduped_specs]
    db_secrets: dict[str, str] = {}

    if session is not None and decrypt is not None:
        import sqlalchemy as sa

        from phoenix.db import models

        rows = (
            await session.scalars(
                sa.select(models.Secret).where(models.Secret.key.in_(lookup_keys))
            )
        ).all()
        for row in rows:
            try:
                db_secrets[row.key] = decrypt(row.value).decode("utf-8")
            except Exception:
                logger.warning(f"Failed to decrypt sandbox credential {row.key!r}", exc_info=True)

    result: dict[str, str] = {}
    for spec in deduped_specs:
        if spec.key in db_secrets:
            result[spec.key] = db_secrets[spec.key]
            continue
        env_val = os.getenv(spec.key)
        if env_val:
            result[spec.key] = env_val
    return result


def _format_required_keys(keys: list[str]) -> str:
    quoted = [f"`{key}`" for key in keys]
    if len(quoted) == 1:
        return quoted[0]
    if len(quoted) == 2:
        return f"{quoted[0]} and {quoted[1]}"
    return f"{', '.join(quoted[:-1])}, and {quoted[-1]}"


async def get_missing_sandbox_auth_detail(
    backend_type: str,
    session: Optional[AsyncSession] = None,
    decrypt: Optional[Callable[[bytes], bytes]] = None,
) -> Optional[str]:
    """Return a user-facing auth requirement message when backend credentials are missing."""
    adapter = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None or not adapter.credential_specs:
        return None

    resolved = await _resolve_sandbox_credentials(session, decrypt, adapter.credential_specs)
    missing_keys = [spec.key for spec in adapter.credential_specs if spec.key not in resolved]
    if not missing_keys:
        return None
    return f"Set {_format_required_keys(missing_keys)}."


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
    return await _resolve_named_credentials(
        session=session,
        decrypt=decrypt,
        keys=credential_specs,
    )


async def build_sandbox_backend(
    backend_type: str,
    config: Mapping[str, Any] | None = None,
    session: Optional[AsyncSession] = None,
    decrypt: Optional[Callable[[bytes], bytes]] = None,
) -> Optional[SandboxBackend]:
    """
    Build a fresh SandboxBackend for backend_type from the supplied config.

    No caching. Every call resolves credentials and constructs a new backend
    via the adapter, so callers MUST NOT rely on instance identity across
    calls — even with the same (backend_type, config), the returned object
    is a new SandboxBackend. Don't add features that depend on per-config
    reuse without first re-introducing an explicit cache.

    Resolves provider credentials (DB Secret → env var fallback) per the
    adapter's credential_specs and merges them over the user-supplied config.
    Resolved credentials win over any matching keys in config — this is a
    defense-in-depth backstop for reserved-name rejection at the mutation
    boundary.

    If config contains an `env_vars` list and session+decrypt are provided,
    secret_ref entries are resolved and the plaintext dict is passed to
    build_backend as user_env (NOT merged into config).

    Raises MissingSecretError if a secret_ref references a missing Secret key.
    Raises UnsupportedOperation / pydantic.ValidationError / ValueError when
    the adapter rejects the effective config (callers surface as BadRequest).

    Returns None if:
    - No adapter is registered for backend_type (optional dep not installed)
    - Backend construction fails with ImportError (extra missing at build time)
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
    cred_keys = {spec.key for spec in adapter.credential_specs}
    user_config = {k: v for k, v in (config or {}).items() if k not in cred_keys}
    validated_config = adapter.validate_config(user_config)
    effective_config: dict[str, Any] = {**validated_config, **provider_creds}

    user_env: dict[str, str] = {}
    raw_env_vars = effective_config.get("env_vars")
    if raw_env_vars:
        # Literal entries resolve unconditionally; secret_refs require DB
        # context and raise MissingSecretError when session/decrypt are absent
        # (fail-closed rather than silent-drop the user-intended env).
        user_env = await _resolve_user_env(raw_env_vars, session, decrypt)

    from pydantic import ValidationError

    try:
        # Each backend populates self.secret_values in __init__ via
        # compose_secret_values(user_env, *credentials). The contract lives on
        # SandboxBackend itself (class-level frozenset() default), so any
        # backend reached here is already secret-mask-ready.
        return adapter.build_backend(effective_config, user_env=user_env)
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
# Register built-in adapters (guarded by per-adapter probe for optional deps).
#
# _KNOWN_ADAPTER_CLASSES tracks every adapter class whose module imports
# successfully — *regardless* of whether its SDK probe passes. The
# reserved-credential-name set is derived from this list (not from
# _SANDBOX_ADAPTERS), so adapter-declared credential keys remain reserved on
# installs that don't have the optional SDK. Without this, a missing optional
# extra would silently narrow the reserved set and let a user-supplied
# env_var or secret_ref shadow a provider credential name.
# ---------------------------------------------------------------------------

_KNOWN_ADAPTER_CLASSES: list[type[SandboxAdapter]] = []


def _try_register_adapter(adapter_cls: type[SandboxAdapter]) -> bool:
    """Track an adapter class and register an instance if the SDK probe passes.

    Returns True if registration succeeded, False if the SDK probe raised
    ImportError. The class is appended to _KNOWN_ADAPTER_CLASSES in either
    case so reserved-name derivation reflects all adapters.
    """
    _KNOWN_ADAPTER_CLASSES.append(adapter_cls)
    try:
        adapter_cls.probe_dependencies()
    except ImportError:
        return False
    register_sandbox_adapter(adapter_cls())
    return True


try:
    from phoenix.server.sandbox.wasm_backend import WASMAdapter

    _try_register_adapter(WASMAdapter)
except ImportError:
    pass

try:
    from phoenix.server.sandbox.e2b_backend import E2BAdapter

    _try_register_adapter(E2BAdapter)
except ImportError:
    pass

try:
    from phoenix.server.sandbox.daytona_backend import (
        DaytonaPythonAdapter,
        DaytonaTypescriptAdapter,
    )

    # Both Daytona adapters share the same SDK (daytona_sdk); the shared probe
    # runs once per call but Python's import cache makes the second call
    # effectively free.
    _try_register_adapter(DaytonaPythonAdapter)
    _try_register_adapter(DaytonaTypescriptAdapter)
except ImportError:
    pass

try:
    from phoenix.server.sandbox.vercel_backend import VercelPythonAdapter, VercelTypescriptAdapter

    # Both Vercel adapters share the same SDK (vercel.sandbox); the shared
    # probe runs once per call but Python's import cache makes the second
    # call effectively free.
    _try_register_adapter(VercelPythonAdapter)
    _try_register_adapter(VercelTypescriptAdapter)
except ImportError:
    pass

try:
    from phoenix.server.sandbox.deno_backend import DenoAdapter

    _try_register_adapter(DenoAdapter)
except ImportError:
    pass

try:
    from phoenix.server.sandbox.modal_backend import ModalAdapter

    _try_register_adapter(ModalAdapter)
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Reserved credential names.
#
# Names reserved by sandbox adapters for provider credentials. User-supplied
# env_vars and SandboxConfig top-level keys matching any of these
# (case-insensitive) are rejected at mutation time so they cannot shadow
# resolved credentials in the factory merge.
# ---------------------------------------------------------------------------


def _build_reserved_credential_names() -> frozenset[str]:
    """Compute the current set of reserved credential names (case-insensitive).

    Resolved on every call so that adapter classes added late (e.g. by tests
    or downstream extensions) participate.

    Walks ``_KNOWN_ADAPTER_CLASSES`` (every adapter whose module imports),
    NOT ``_SANDBOX_ADAPTERS`` (only adapters whose SDK probe passed). The
    distinction matters: an installation without an optional sandbox extra
    still has its adapter class in _KNOWN_ADAPTER_CLASSES, so the adapter's
    declared credential keys remain reserved regardless of whether the SDK is
    installed — otherwise a user-supplied env_var or secret_ref on that name
    could shadow the provider credential the moment the SDK is later installed.
    """
    names: set[str] = set()
    for adapter_cls in _KNOWN_ADAPTER_CLASSES:
        for spec in adapter_cls.credential_specs:
            names.add(spec.key.lower())
    return frozenset(names)


def is_reserved_credential_name(name: str) -> bool:
    """Return True if `name` collides with a reserved provider-credential key.

    Comparison is case-insensitive: `VERCEL_TOKEN`,
    `Vercel_Token`, and `vercel_token` are all reserved.
    """
    return name.lower() in _build_reserved_credential_names()
