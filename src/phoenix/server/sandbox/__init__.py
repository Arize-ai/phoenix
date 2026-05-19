"""
Sandbox backend registry and factory.

Two tiers:
- SANDBOX_ADAPTER_METADATA: static, read-only mapping keyed by canonical
  provider ``kind``. Always present — used for DB seeding and UI display
  regardless of optional extras.
- _SANDBOX_ADAPTERS: internal mutable storage for adapters whose optional
  dependency probe passed. Reads are filtered by
  PHOENIX_ALLOWED_SANDBOX_PROVIDERS.
- SANDBOX_ADAPTERS: read-only facade over the runtime registry. Used by
  backend construction and status paths.

Adapter modules with optional SDK extras (wasmtime, e2b, daytona, vercel,
modal) keep their SDK imports lazy so the modules remain importable in test
environments where the extra is absent. Availability is gated at registration
time by ``Adapter.probe_dependencies()``: each adapter overrides the classmethod
to import its SDK; the registration block below probes then registers. A
missing extra leaves the adapter absent from ``_SANDBOX_ADAPTERS`` so the
status resolver reports ``NOT_INSTALLED`` and surfaces dependency hints in the
UI.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Iterable,
    Iterator,
    Literal,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    cast,
    get_args,
)

import sqlalchemy as sa
from pydantic import ValidationError

from phoenix.config import get_env_allowed_sandbox_providers
from phoenix.db import models
from phoenix.db.models import LanguageName, SandboxBackendType
from phoenix.server.sandbox.daytona_backend import DaytonaAdapter
from phoenix.server.sandbox.deno_backend import DenoAdapter
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.modal_backend import ModalAdapter
from phoenix.server.sandbox.types import (
    EnvVarValue,
    SandboxAdapter,
    SandboxBackend,
    SupportsDependencies,
    SupportsEnvVars,
    SupportsInternetAccess,
    UnsupportedOperation,
)
from phoenix.server.sandbox.types import (
    ProviderCredentialSpec as ProviderCredentialSpec,
)
from phoenix.server.sandbox.vercel_backend import VercelAdapter
from phoenix.server.sandbox.wasm_backend import WASMAdapter

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
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
    - ``supports_dependencies``: a binary flag in the current capability-mixin
      design. Package ecosystem validation follows the config's execution
      language (Python pip / TypeScript npm).

    ## Per-capability contracts

    **supports_env_vars** — session-level user-defined environment variables.
    When ``True``, the adapter's ``build_backend`` MUST accept ``user_env``
    (the pre-resolved plaintext name→value dict) and forward it to the
    underlying runtime at constructor time so that every subsequent
    ``execute()`` call sees the variables without a per-call override.
    When ``False``, the adapter's Config omits ``env_vars`` and pydantic
    rejects authored env vars before ``build_backend`` is called.
    ``SandboxBackend.execute`` takes only ``code``, ``session_key``, and
    ``timeout`` — there is no per-call env override.

    **internet_access_capability** — controls whether the sandbox can reach
    the internet. ``'none'``: adapter does not support this capability, so the
    adapter's Config omits ``internet_access`` and pydantic rejects authored
    modes before ``build_backend`` is called. ``'boolean'``: adapter supports a
    simple allow/deny toggle. ``'allowlist'``: adapter supports a per-domain
    allowlist (reserved for future use; not currently user-selectable).
    Distinct from the runtime ``internet_access`` block on
    SandboxConfig.config, which is the admin/user-authored runtime mode.

    **supports_dependencies** — whether the adapter installs user-supplied
    ``dependencies.packages`` before running code. When ``False``,
    ``dependencies.packages`` is rejected by the per-adapter Config's
    ``extra='forbid'`` (the adapter's Config doesn't compose
    ``SupportsDependencies``). The ecosystem matches the execution language —
    Python pip / TypeScript npm; no adapter cross-installs.
    """

    display_name: str
    supported_languages: frozenset[LanguageName]
    dependency_hints: Sequence[str] = field(default_factory=list)

    #: Whether this adapter installs ``dependencies.packages`` before running
    #: code (for any of its ``supported_languages``). Either it does (for all
    #: of them) or it doesn't — partial per-language support isn't expressible
    #: in the current capability-mixin design.
    supports_dependencies: bool = False

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
    # time; execute() has no per-call env override. False → the Config model
    # omits env_vars, so authored env vars fail validation before backend
    # construction.
    # UI: True → render the Env Vars editor; False → render a muted
    # "Not supported by the selected backend." placeholder.
    supports_env_vars: bool = False

    # Value semantics: 'none' → capability not supported and the Config model
    # omits internet_access. 'boolean' → simple allow/deny toggle supported.
    # 'allowlist' → per-domain allowlist reserved for future use; not currently
    # user-selectable via the UI.
    # UI: 'none' → render muted placeholder; 'boolean' → render toggle;
    # 'allowlist' → reserved, do not expose in structured UI or JSON editor.
    # Note: this is the adapter-level capability flag, distinct from the
    # runtime `internet_access` block stored on SandboxConfig.config.
    internet_access_capability: Literal["none", "boolean", "allowlist"] = "none"

    @classmethod
    def from_cls(cls, adapter_cls: type[SandboxAdapter[Any, Any, Any]]) -> "AdapterMetadata":
        """Derive metadata from a ``SandboxAdapter`` subclass.

        Everything that has a structural counterpart on the adapter / its
        ``config_model`` is read off the class:

        - ``supported_languages``: the ``Literal`` args on the Config's
          ``language`` field.
        - ``supports_env_vars`` / ``internet_access_capability`` /
          ``supports_dependencies``: presence of the corresponding capability
          mixin on the Config (``SupportsEnvVars``, ``SupportsInternetAccess``,
          ``SupportsDependencies``).

        Fields that have no structural counterpart (``display_name``,
        ``hosting_type``, ``dependency_hints``) live as ClassVars on the
        adapter itself and are copied through. Each adapter is the single
        source of truth for every metadata field.
        """

        config_model = cast(type[Any], getattr(adapter_cls, "config_model"))
        supported_languages: frozenset[LanguageName] = frozenset(
            get_args(config_model.model_fields["language"].annotation)
        )
        supports_env_vars = issubclass(config_model, SupportsEnvVars)
        supports_internet_access = issubclass(config_model, SupportsInternetAccess)
        supports_dependencies = issubclass(config_model, SupportsDependencies)
        return cls(
            display_name=adapter_cls.display_name,
            supported_languages=supported_languages,
            dependency_hints=list(adapter_cls.dependency_hints),
            supports_dependencies=supports_dependencies,
            hosting_type=adapter_cls.hosting_type,
            supports_env_vars=supports_env_vars,
            internet_access_capability="boolean" if supports_internet_access else "none",
        )


def _build_sandbox_adapter_metadata() -> Mapping[SandboxBackendType, AdapterMetadata]:
    """One ``AdapterMetadata`` per adapter class, derived via ``from_cls``.

    Adapter classes have lazy SDK imports, so this module load doesn't require
    any optional extras. ``AdapterMetadata`` stays a pure-introspection product
    of each adapter class — no separate declaration to drift out of sync.
    """
    return {
        cls.backend_type: AdapterMetadata.from_cls(cls)
        for cls in (
            WASMAdapter,
            E2BAdapter,
            DaytonaAdapter,
            VercelAdapter,
            DenoAdapter,
            ModalAdapter,
        )
    }


# Static metadata — always present regardless of installed extras.
# One entry per sandbox provider ``kind`` (matches ``sandbox_providers.backend_type``).
# Annotated as ``Mapping`` to document the read-only production contract; the
# runtime is still a plain dict so tests can use ``monkeypatch.setitem`` /
# ``patch.dict`` to inject fakes.
SANDBOX_ADAPTER_METADATA: Mapping[SandboxBackendType, AdapterMetadata] = (
    _build_sandbox_adapter_metadata()
)

# ---------------------------------------------------------------------------
# Runtime registry — populated only when the backend's optional deps are
# installed. Modified via register_sandbox_adapter().
# ---------------------------------------------------------------------------


class _AllowlistGatedAdapterRegistry(
    MutableMapping[SandboxBackendType, SandboxAdapter[Any, Any, Any]]
):
    """Registry of sandbox adapters with read-time allowlist filtering.

    Storage is delegated to an internal dict. Reads consult
    PHOENIX_ALLOWED_SANDBOX_PROVIDERS via ``get_env_allowed_sandbox_providers()``
    and skip adapters whose :attr:`~SandboxAdapter.kind` is not in the allowed
    set. Writes are unfiltered — registration at import time should always
    succeed; the gate filters who can reach the value afterward.

    Disallowed keys appear absent: ``__getitem__`` raises KeyError,
    ``.get()`` returns the default, ``in`` returns False, and iteration /
    len / keys / values / items skip them.
    """

    def __init__(self) -> None:
        self._adapters: dict[SandboxBackendType, SandboxAdapter[Any, Any, Any]] = {}

    @staticmethod
    def _allowed(adapter: SandboxAdapter[Any, Any, Any]) -> bool:
        return adapter.backend_type in get_env_allowed_sandbox_providers()

    def __getitem__(self, key: SandboxBackendType) -> SandboxAdapter[Any, Any, Any]:
        adapter = self._adapters[key]
        if not self._allowed(adapter):
            raise KeyError(key)
        return adapter

    def __setitem__(self, key: SandboxBackendType, value: SandboxAdapter[Any, Any, Any]) -> None:
        self._adapters[key] = value

    def __delitem__(self, key: SandboxBackendType) -> None:
        del self._adapters[key]

    def __iter__(self) -> Iterator[SandboxBackendType]:
        allowed = get_env_allowed_sandbox_providers()
        return (k for k, v in self._adapters.items() if v.backend_type in allowed)

    def __len__(self) -> int:
        allowed = get_env_allowed_sandbox_providers()
        return sum(1 for v in self._adapters.values() if v.backend_type in allowed)

    def __contains__(self, key: object) -> bool:
        return key in self._adapters and self._allowed(
            self._adapters[cast(SandboxBackendType, key)]
        )


_SANDBOX_ADAPTERS: MutableMapping[SandboxBackendType, SandboxAdapter[Any, Any, Any]] = (
    _AllowlistGatedAdapterRegistry()
)


class AdapterRegistry:
    def get(self, backend_type: SandboxBackendType) -> Optional[SandboxAdapter[Any, Any, Any]]:
        return _SANDBOX_ADAPTERS.get(backend_type)

    def __contains__(self, key: object) -> bool:
        return key in _SANDBOX_ADAPTERS


SANDBOX_ADAPTERS = AdapterRegistry()


def register_sandbox_adapter(
    adapter: SandboxAdapter[Any, Any, Any],
) -> SandboxAdapter[Any, Any, Any]:
    """Register a SandboxAdapter in the runtime registry."""
    _SANDBOX_ADAPTERS[adapter.backend_type] = adapter
    logger.debug(f"Registered sandbox adapter: {adapter.backend_type!r}")
    return adapter


class MissingSecretError(Exception):
    """Raised when a secret_ref entry references a Secret key that does not exist."""


@dataclass(frozen=True)
class SecretsContext:
    """DB context needed to resolve sandbox secrets (provider credentials +
    user-env secret_refs).

    ``session`` reads the ``secrets`` table; ``decrypt`` turns the row's
    encrypted blob into plaintext. The two were separate ``Optional``
    parameters historically; this dataclass encodes the actual binary
    state ("can resolve secrets, yes/no") so callers pass one
    ``SecretsContext`` instead. Required everywhere — production callers
    always have both (DB session + the context's ``decrypt`` callable);
    tests that want to simulate "no DB results" pass a mock whose
    ``session.scalars`` / ``session.get`` return empties rather than
    skipping the context entirely.
    """

    session: AsyncSession
    decrypt: Callable[[bytes], bytes]

    async def fetch_secrets(self, keys: Iterable[str]) -> tuple[dict[str, str], list[str]]:
        """Look up Secret rows by key, decrypt their values, return
        ``(resolved, decrypt_failures)``.

        - ``resolved`` maps key → plaintext for every key whose row was
          found AND decrypted successfully.
        - ``decrypt_failures`` is the subset of keys whose row was found
          but failed to decrypt. Callers decide whether to raise or
          warn-and-skip.
        - Keys present in neither return value were absent from the
          ``secrets`` table. The caller computes "missing keys" by set
          difference against the requested ``keys``.

        Centralizes the SQL+decrypt pair so callers don't duplicate it.
        """
        key_list = list(keys)
        if not key_list:
            return {}, []

        rows = (
            await self.session.scalars(
                sa.select(models.Secret).where(models.Secret.key.in_(key_list))
            )
        ).all()
        resolved: dict[str, str] = {}
        decrypt_failures: list[str] = []
        for row in rows:
            try:
                resolved[row.key] = self.decrypt(row.value).decode("utf-8")
            except Exception:
                logger.warning(f"Failed to decrypt sandbox secret {row.key!r}", exc_info=True)
                decrypt_failures.append(row.key)
        return resolved, decrypt_failures

    async def resolve_credentials(
        self,
        credential_specs: Sequence[ProviderCredentialSpec],
    ) -> dict[str, str]:
        """Resolve provider credentials via DB secret lookup + env-var fallback.

        For each spec: query the secrets table first (via ``fetch_secrets``),
        fall back to ``os.getenv``. Keys absent from both tiers are omitted
        from the result. Decrypt failures are logged-and-skipped, not raised
        — provider auth is best-effort at probe time, and the env fallback
        covers a re-keyed deployment.
        """
        if not credential_specs:
            return {}
        deduped_specs = list({spec.key: spec for spec in credential_specs}.values())
        lookup_keys = [spec.key for spec in deduped_specs]
        db_secrets, decrypt_failures = await self.fetch_secrets(lookup_keys)
        for key in decrypt_failures:
            logger.warning(f"Skipping undecryptable sandbox credential {key!r}")
        result: dict[str, str] = {}
        for spec in deduped_specs:
            if spec.key in db_secrets:
                result[spec.key] = db_secrets[spec.key]
                continue
            env_val = os.getenv(spec.key)
            if env_val:
                result[spec.key] = env_val
        return result

    async def resolve_user_env(
        self,
        env_vars: Mapping[str, EnvVarValue],
    ) -> dict[str, str]:
        """Resolve secret_ref env vars and return plaintext name→value dict.

        Secret-ref entries go through ``fetch_secrets``; decrypt failures and
        missing rows both surface as ``MissingSecretError`` (fail-closed —
        silently dropping would leave the user-intended env absent at
        ``execute()`` time with no diagnostic).

        No reserved-name check on ``secret_key``: a user-level env_var entry
        may name the same secret key that backs a provider's auth credential
        (e.g. ``secret_key="E2B_API_KEY"``). This is intentional — sandbox env
        authorship is the trust boundary, and a code evaluator author can read
        injected sandbox env values at execute time via ``os.environ``. See
        ``api/helpers/sandbox_redaction.py`` for the broader threat model.
        """
        # Collect secret keys that need DB resolution (deduplicated, order-preserving)
        secret_keys: list[str] = []
        seen: set[str] = set()
        for entry in env_vars.values():
            if entry.secret_key not in seen:
                secret_keys.append(entry.secret_key)
                seen.add(entry.secret_key)

        resolved_secrets, decrypt_failures = await self.fetch_secrets(secret_keys)
        if decrypt_failures:
            raise MissingSecretError(
                f"Secret '{sorted(decrypt_failures)[0]}' exists but could not be decrypted"
            )
        missing = set(secret_keys) - set(resolved_secrets.keys())
        if missing:
            raise MissingSecretError(
                f"Referenced secret key(s) not found: {', '.join(sorted(missing))}"
            )

        user_env: dict[str, str] = {}
        for name, entry in env_vars.items():
            user_env[name] = resolved_secrets[entry.secret_key]
        return user_env

    async def missing_auth_detail(
        self,
        backend_type: SandboxBackendType,
    ) -> Optional[str]:
        """Return a user-facing auth-requirement message when the provider's
        credentials are not all resolvable through this context, or ``None``
        when every required credential is present.

        Used by ``get_sandbox_backend_info`` to distinguish
        ``MISSING_CREDENTIALS`` from ``AVAILABLE``. Returns ``None`` for
        adapters that aren't registered or declare no credentials.
        """
        adapter = SANDBOX_ADAPTERS.get(backend_type)
        if adapter is None:
            return None
        specs = adapter.credential_specs()
        if not specs:
            return None
        resolved = await self.resolve_credentials(specs)
        missing_keys = [spec.key for spec in specs if spec.key not in resolved]
        if not missing_keys:
            return None
        return f"Set {_format_required_keys(missing_keys)}."


def _format_required_keys(keys: list[str]) -> str:
    quoted = [f"`{key}`" for key in keys]
    if len(quoted) == 1:
        return quoted[0]
    if len(quoted) == 2:
        return f"{quoted[0]} and {quoted[1]}"
    return f"{', '.join(quoted[:-1])}, and {quoted[-1]}"


async def build_sandbox_backend(
    sandbox_config: models.SandboxConfig,
    *,
    secrets: SecretsContext,
) -> Optional[SandboxBackend]:
    """Build a fresh ``SandboxBackend`` from a stored ``SandboxConfig`` row.

    Reads provider kind, execution language, and config blob off the row. Returns
    ``None`` when the adapter is not registered (optional SDK extra missing).

    No caching. Every call resolves credentials and constructs a new backend.
    """
    return await _build_backend_for(
        sandbox_config.backend_type,
        config=sandbox_config.config or {},
        secrets=secrets,
    )


async def probe_sandbox_backend_buildable(
    backend_type: SandboxBackendType,
    *,
    language: LanguageName,
    secrets: SecretsContext,
) -> Optional[SandboxBackend]:
    """Build a backend with a minimal config to verify the adapter is buildable.

    The intent is verification only — the returned backend is discarded. Used
    by the ``sandboxBackends`` GraphQL resolver to distinguish ``AVAILABLE``
    from ``MISSING_CREDENTIALS`` / ``UNAVAILABLE`` / ``NOT_INSTALLED``: a
    successful return → AVAILABLE; a raised pydantic / missing-secret /
    unsupported-op error → UNAVAILABLE with the exception message. The status
    resolver checks registration before calling this probe; if this function
    still returns ``None``, that is treated as ``UNAVAILABLE``.

    The "construct and throw away" pattern is intentional: each adapter's
    ``build_backend`` performs the full validation chain (credentials,
    deployment routing, capability gates) without doing network I/O, so it
    doubles as the dry-run probe. A future refactor that adds a dedicated
    ``validate_buildable()`` classmethod per adapter would be cleaner, but
    until then this is the single hook.

    ``language`` is required because the per-adapter Config models for
    multi-language adapters (Daytona, Vercel) declare ``language: Literal[
    "PYTHON", "TYPESCRIPT"]`` without a default — the probe synthesizes a
    minimal config dict here so they validate.
    """
    return await _build_backend_for(
        backend_type,
        config={"language": language},
        secrets=secrets,
    )


async def _build_backend_for(
    backend_type: SandboxBackendType,
    *,
    config: Mapping[str, Any],
    secrets: SecretsContext,
) -> Optional[SandboxBackend]:
    """Internal: shared body for ``build_sandbox_backend`` and
    ``probe_sandbox_backend_buildable``.

    Looks up the adapter, validates config + credentials + deployment, resolves
    user env vars, and constructs the backend. Returns ``None`` when the
    adapter is not registered.

    ``config`` MUST carry the ``language`` discriminator — callers (both the
    build path and the probe path) guarantee this. For the build path,
    stored row blobs include ``language`` because writes go through
    ``model_dump``; for the probe path, the wrapper synthesizes a
    ``{"language": ...}`` dict.
    """
    adapter = SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        logger.debug(
            "No adapter registered for backend_type=%r; optional dependency may not be installed",
            backend_type,
        )
        return None

    validated_config = adapter.config_model.model_validate(config)

    # Resolve provider credentials (DB secret → env var fallback) and validate
    # them through the adapter's typed credentials_model. Missing required keys
    # surface as a pydantic ValidationError (downstream raise as a ValueError
    # with the actionable message).
    provider_creds = await secrets.resolve_credentials(adapter.credential_specs())

    try:
        typed_credentials = adapter.credentials_model.model_validate(provider_creds)
    except ValidationError:
        # Missing credentials reach the adapter, which raises the actionable
        # "set X in Settings → Sandboxes" message. Validate strictly first so
        # malformed values fail closed instead of being silently coerced.
        raise

    # Load the admin-scoped deployment routing from ``SandboxProvider.config``
    # and turn it into the adapter's typed ``deployment_config_model`` instance
    # — ``build_backend`` takes a typed Deployment, not a raw dict. Falls back
    # to the model's empty defaults when there's no row (fresh install).
    # ``model_validate`` also re-runs URL-scheme checks; that's defense-in-
    # depth against direct-DB tampering and forward-compat against future
    # stricter validators, not an SSRF gate (writes are admin-gated and
    # already validate identically).
    provider_row = await secrets.session.get(models.SandboxProvider, adapter.backend_type)
    deployment_blob = provider_row.config or {} if provider_row is not None else {}
    typed_deployment = adapter.deployment_config_model.model_validate(deployment_blob)

    user_env: dict[str, str] = {}
    env_vars: Mapping[str, EnvVarValue] = {}
    if isinstance(validated_config, SupportsEnvVars):
        env_vars = validated_config.env_vars
    if env_vars:
        user_env = await secrets.resolve_user_env(env_vars)

    try:
        # Each backend populates self.secret_values in __init__ via
        # compose_secret_values(user_env, *credentials). The contract lives on
        # SandboxBackend itself (class-level frozenset() default), so any
        # backend reached here is already secret-mask-ready.
        return adapter.build_backend(
            validated_config,
            credentials=typed_credentials,
            deployment=typed_deployment,
            user_env=user_env,
        )
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
# ---------------------------------------------------------------------------


def _try_register_adapter(adapter_cls: type[SandboxAdapter[Any, Any, Any]]) -> bool:
    """Register an adapter instance if the SDK probe passes.

    Returns True on success, False if the SDK probe raised ImportError.
    """
    try:
        adapter_cls.probe_dependencies()
    except ImportError:
        return False
    register_sandbox_adapter(adapter_cls())
    return True


# Register every adapter whose SDK extras are available. The adapter classes
# themselves load unconditionally (their SDK imports are lazy — inside
# ``probe_dependencies`` or per-method bodies); ``_try_register_adapter``
# catches the ImportError from the SDK probe and silently skips the adapter
# so the registry only contains entries the runtime can actually build.
_try_register_adapter(WASMAdapter)
_try_register_adapter(E2BAdapter)
_try_register_adapter(DaytonaAdapter)
_try_register_adapter(VercelAdapter)
_try_register_adapter(DenoAdapter)
_try_register_adapter(ModalAdapter)
