"""Sandbox backend registry and factory."""

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
    """Capability advertisement for a sandbox adapter."""

    display_name: str
    supported_languages: frozenset[LanguageName]
    dependency_hints: Sequence[str] = field(default_factory=list)
    supports_dependencies: bool = False
    hosting_type: Literal["local", "hosted"] = "hosted"
    supports_env_vars: bool = False
    internet_access_capability: Literal["none", "boolean"] = "none"
    auto_seedable: bool = False

    @classmethod
    def from_cls(cls, adapter_cls: type[SandboxAdapter[Any, Any, Any]]) -> "AdapterMetadata":
        """Derive metadata from a SandboxAdapter subclass."""
        config_model = cast(type[Any], getattr(adapter_cls, "config_model"))
        supported_languages: frozenset[LanguageName] = frozenset(
            get_args(config_model.model_fields["language"].annotation)
        )
        supports_env_vars = issubclass(config_model, SupportsEnvVars)
        supports_internet_access = issubclass(config_model, SupportsInternetAccess)
        supports_dependencies = issubclass(config_model, SupportsDependencies)
        internet_access_capability: Literal["none", "boolean"] = (
            "boolean" if supports_internet_access else "none"
        )
        auto_seedable = (
            (not supports_env_vars)
            and (internet_access_capability == "none")
            and (not supports_dependencies)
            and (adapter_cls.hosting_type == "local")
        )
        return cls(
            display_name=adapter_cls.display_name,
            supported_languages=supported_languages,
            dependency_hints=list(adapter_cls.dependency_hints),
            supports_dependencies=supports_dependencies,
            hosting_type=adapter_cls.hosting_type,
            supports_env_vars=supports_env_vars,
            internet_access_capability=internet_access_capability,
            auto_seedable=auto_seedable,
        )


def _build_sandbox_adapter_metadata() -> Mapping[SandboxBackendType, AdapterMetadata]:
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


SANDBOX_ADAPTER_METADATA: Mapping[SandboxBackendType, AdapterMetadata] = (
    _build_sandbox_adapter_metadata()
)


class _AllowlistGatedAdapterRegistry(
    MutableMapping[SandboxBackendType, SandboxAdapter[Any, Any, Any]]
):
    """Registry of sandbox adapters with read-time PHOENIX_ALLOWED_SANDBOX_PROVIDERS filtering."""

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
        return key in self._adapters and self._allowed(self._adapters[key])


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
    """DB context for resolving sandbox secrets (provider credentials + user-env secret_refs)."""

    session: AsyncSession
    decrypt: Callable[[bytes], bytes]

    async def fetch_secrets(self, keys: Iterable[str]) -> tuple[dict[str, str], list[str]]:
        """Look up Secret rows by key, decrypt, return ``(resolved, decrypt_failures)``."""
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
        """Resolve provider credentials via DB secret lookup + env-var fallback."""
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
        """Resolve secret_ref env vars to plaintext; fail-closed on missing/undecryptable."""
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
        """Return a user-facing auth-requirement message, or None when all credentials resolve."""
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
    """Build a fresh SandboxBackend from a stored SandboxConfig row."""
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
    """Build a backend with a minimal config to verify the adapter is buildable."""
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
    # Caller must pass ``language`` in config; stored blobs and the probe wrapper both do.
    adapter = SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        logger.debug(
            "No adapter registered for backend_type=%r; optional dependency may not be installed",
            backend_type,
        )
        return None

    validated_config = adapter.config_model.model_validate(config)

    provider_creds = await secrets.resolve_credentials(adapter.credential_specs())
    typed_credentials = adapter.credentials_model.model_validate(provider_creds)

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
        return adapter.build_backend(
            validated_config,
            credentials=typed_credentials,
            deployment=typed_deployment,
            user_env=user_env,
        )
    except (MissingSecretError, UnsupportedOperation, ValidationError, ValueError):
        raise
    except ImportError as exc:
        logger.warning(
            f"Optional dependency unavailable for sandbox backend {backend_type!r}: {exc}",
            exc_info=True,
        )
        return None


def _try_register_adapter(adapter_cls: type[SandboxAdapter[Any, Any, Any]]) -> bool:
    """Register an adapter instance if the SDK probe passes."""
    try:
        adapter_cls.probe_dependencies()
    except ImportError:
        return False
    register_sandbox_adapter(adapter_cls())
    return True


_try_register_adapter(WASMAdapter)
_try_register_adapter(E2BAdapter)
_try_register_adapter(DaytonaAdapter)
_try_register_adapter(VercelAdapter)
_try_register_adapter(DenoAdapter)
_try_register_adapter(ModalAdapter)
