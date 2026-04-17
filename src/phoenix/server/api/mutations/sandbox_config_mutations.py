"""
GraphQL mutations for managing sandbox backend configuration.

Provides CRUD for SandboxConfig rows (named per-provider configs that
CodeEvaluators point to) and update operations for SandboxProvider rows.

Contract: `config` is the sole mutation payload boundary for adapter-specific
settings. New sections (env_vars, internet_access, dependencies) live inside
`config` as nested keys — not as sibling GraphQL arguments — and are validated
through each adapter's `validate_config` / pydantic config_model. The frontend
builds the JSON payload using ConfigFieldSpec entries derived from the adapter
models; it never needs to know about adapter-specific field names at the GQL
layer. Do not add sibling typed-input fields for the new sections.
"""

from typing import Any

import strawberry
from pydantic import ValidationError
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import (
    CreateSandboxConfigInput,
    SandboxConfig,
    UpdateSandboxConfigInput,
    UpdateSandboxProviderInput,
    sandbox_config_from_input,
    to_gql_sandbox_config,
    to_gql_sandbox_provider,
)
from phoenix.server.api.types.SandboxConfig import (
    SandboxProvider as SandboxProviderType,
)
from phoenix.server.sandbox import (
    _SANDBOX_ADAPTERS,
    invalidate_backend_cache,
    invalidate_backend_cache_for_key,
    is_reserved_credential_name,
)


def _check_env_var_collision(env_vars: Any, backend_type: str) -> None:
    """Raise BadRequest if any env_var name collides with a reserved
    provider-credential key.

    `env_vars` is the raw list from SandboxConfig.config (dicts or pydantic
    models); callers pass `config_dict.get("env_vars")`. `backend_type` is
    included in the error message for caller context. Comparison is
    case-insensitive (see `is_reserved_credential_name`).
    """
    if not env_vars:
        return
    for entry in env_vars:
        name = entry.get("name", "") if isinstance(entry, dict) else getattr(entry, "name", "")
        if name and is_reserved_credential_name(name):
            raise BadRequest(
                f"Environment variable name {name!r} is reserved as a sandbox "
                f"provider credential for {backend_type!r} and cannot be set "
                "as a user env_var. Choose a different name or store the value "
                "via setSandboxCredential."
            )


def _check_reserved_top_level_keys(config_dict: dict[str, Any], backend_type: str) -> None:
    """Raise BadRequest if any top-level key in `config_dict` collides with a
    reserved provider-credential key.

    Guards against credential-shadowing via `config`'s top-level keys
    (SandboxConfig.config uses extra="allow", so arbitrary keys pass pydantic
    validation). `backend_type` is included in the error message for context.
    Comparison is case-insensitive (see `is_reserved_credential_name`).
    """
    if not config_dict:
        return
    for key in config_dict:
        if is_reserved_credential_name(key):
            raise BadRequest(
                f"Config key {key!r} is reserved as a sandbox provider "
                f"credential for {backend_type!r} and cannot be set via "
                "config. Store the credential via setSandboxCredential instead."
            )


# ---------------------------------------------------------------------------
# Payload types
# ---------------------------------------------------------------------------


@strawberry.type
class CreateSandboxConfigPayload:
    sandbox_config: SandboxConfig
    query: Query


@strawberry.type
class UpdateSandboxConfigPayload:
    sandbox_config: SandboxConfig
    query: Query


@strawberry.type
class DeleteSandboxConfigPayload:
    deleted_id: GlobalID
    query: Query


@strawberry.type
class UpdateSandboxProviderPayload:
    sandbox_provider: SandboxProviderType
    query: Query


@strawberry.type
class SetSandboxCredentialPayload:
    backend_type: str
    key: str
    query: Query


@strawberry.type
class DeleteSandboxCredentialPayload:
    backend_type: str
    key: str
    query: Query


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_sandbox_credential_key(backend_type: str, key: str) -> None:
    """Raise BadRequest if backend_type is unknown or key is not in adapter's credential_specs."""
    adapter = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        raise BadRequest(f"Unknown sandbox backend type: {backend_type!r}")
    valid_keys = {spec.key for spec in adapter.credential_specs}
    if key not in valid_keys:
        raise BadRequest(
            f"Key {key!r} is not a valid credential for backend {backend_type!r}. "
            f"Valid keys: {sorted(valid_keys)}"
        )


# ---------------------------------------------------------------------------
# Mixin
# ---------------------------------------------------------------------------


@strawberry.type
class SandboxConfigMutationMixin:
    """Mutations for sandbox backend configuration management."""

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def create_sandbox_config(
        self,
        info: Info[Context, None],
        input: CreateSandboxConfigInput,
    ) -> CreateSandboxConfigPayload:
        """Create a new named sandbox configuration under an existing provider."""
        from sqlalchemy import select

        async with info.context.db() as session:
            provider_id = from_global_id_with_expected_type(
                input.sandbox_provider_id,
                expected_type_name=SandboxProviderType.__name__,
            )
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.id == provider_id)
            )
            if provider is None:
                raise NotFound(f"SandboxProvider not found: {provider_id}")

            values = sandbox_config_from_input(input, provider_id=provider_id)
            config_dict = values.get("config", {}) or {}
            _check_env_var_collision(config_dict.get("env_vars"), provider.backend_type)
            _check_reserved_top_level_keys(config_dict, provider.backend_type)
            adapter = _SANDBOX_ADAPTERS.get(provider.backend_type)
            if adapter is not None:
                try:
                    config_dict = adapter.validate_config(config_dict)
                except (ValueError, ValidationError) as exc:
                    raise BadRequest(str(exc))
            values["config"] = config_dict

            row = models.SandboxConfig(**values)
            session.add(row)
            await session.flush()
            await session.refresh(row)

        return CreateSandboxConfigPayload(
            sandbox_config=to_gql_sandbox_config(row),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def update_sandbox_config(
        self,
        info: Info[Context, None],
        input: UpdateSandboxConfigInput,
    ) -> UpdateSandboxConfigPayload:
        """Update fields on an existing SandboxConfig."""
        from sqlalchemy import select

        async with info.context.db() as session:
            config_id = from_global_id_with_expected_type(
                input.id,
                expected_type_name=SandboxConfig.__name__,
            )
            row = await session.scalar(
                select(models.SandboxConfig).where(models.SandboxConfig.id == config_id)
            )
            if row is None:
                raise NotFound(f"SandboxConfig not found: {config_id}")

            if input.description is not strawberry.UNSET:
                row.description = input.description
            if input.config is not strawberry.UNSET:
                config_dict = dict(input.config) if input.config is not None else {}
                provider = await session.scalar(
                    select(models.SandboxProvider).where(
                        models.SandboxProvider.id == row.sandbox_provider_id
                    )
                )
                if provider is not None:
                    _check_env_var_collision(config_dict.get("env_vars"), provider.backend_type)
                    _check_reserved_top_level_keys(config_dict, provider.backend_type)
                    adapter = _SANDBOX_ADAPTERS.get(provider.backend_type)
                    if adapter is not None:
                        try:
                            config_dict = adapter.validate_config(config_dict)
                        except ValueError as exc:
                            raise BadRequest(str(exc))
                row.config = config_dict
            if input.timeout is not strawberry.UNSET:
                row.timeout = input.timeout if input.timeout is not None else 30
            if input.enabled is not strawberry.UNSET and input.enabled is not None:
                row.enabled = input.enabled

            await session.flush()
            await session.refresh(row)

        return UpdateSandboxConfigPayload(
            sandbox_config=to_gql_sandbox_config(row),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_sandbox_config(
        self,
        info: Info[Context, None],
        id: GlobalID,
    ) -> DeleteSandboxConfigPayload:
        """Delete a SandboxConfig by GlobalID."""
        config_id = from_global_id_with_expected_type(
            id,
            expected_type_name=SandboxConfig.__name__,
        )
        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, config_id)
            if row is None:
                raise NotFound(f"SandboxConfig not found: {config_id}")
            await session.delete(row)

        return DeleteSandboxConfigPayload(deleted_id=id, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_sandbox_provider(
        self,
        info: Info[Context, None],
        input: UpdateSandboxProviderInput,
    ) -> UpdateSandboxProviderPayload:
        """Update provider-level sandbox settings such as config and enabled state."""
        from sqlalchemy import select

        async with info.context.db() as session:
            provider_id = from_global_id_with_expected_type(
                input.id,
                expected_type_name=SandboxProviderType.__name__,
            )
            row = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.id == provider_id)
            )
            if row is None:
                raise NotFound(f"SandboxProvider not found: {provider_id}")

            if input.config is not strawberry.UNSET:
                config_dict = dict(input.config) if input.config is not None else {}
                _check_reserved_top_level_keys(config_dict, row.backend_type)
                row.config = config_dict
            if input.enabled is not strawberry.UNSET and input.enabled is not None:
                row.enabled = input.enabled

            await session.flush()
            await session.refresh(row)

        return UpdateSandboxProviderPayload(
            sandbox_provider=to_gql_sandbox_provider(row),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def set_sandbox_credential(
        self,
        info: Info[Context, None],
        backend_type: str,
        key: str,
        value: str,
    ) -> SetSandboxCredentialPayload:
        """Encrypt and upsert a sandbox provider credential into the secrets table."""
        _validate_sandbox_credential_key(backend_type, key)
        value = value.strip()
        if not value:
            raise BadRequest("Credential value cannot be empty")
        encrypted = info.context.encrypt(value.encode("utf-8"))
        dialect = SupportedSQLDialect(info.context.db.dialect.name)
        async with info.context.db() as session:
            await session.execute(
                insert_on_conflict(
                    {"key": key, "value": encrypted, "user_id": None},
                    dialect=dialect,
                    table=models.Secret,
                    unique_by=("key",),
                    constraint_name="pk_secrets",
                    on_conflict=OnConflict.DO_UPDATE,
                )
            )
        # Key-level fan-out covers shared credential_specs (e.g., VERCEL_TOKEN
        # shared between VERCEL_PYTHON and VERCEL_TYPESCRIPT). Per-backend_type
        # invalidation remains as a defense-in-depth backstop.
        await invalidate_backend_cache_for_key(key)
        await invalidate_backend_cache(backend_type)
        return SetSandboxCredentialPayload(backend_type=backend_type, key=key, query=Query())

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def delete_sandbox_credential(
        self,
        info: Info[Context, None],
        backend_type: str,
        key: str,
    ) -> DeleteSandboxCredentialPayload:
        """Delete a sandbox provider credential from the secrets table."""
        _validate_sandbox_credential_key(backend_type, key)
        import sqlalchemy as sa

        async with info.context.db() as session:
            await session.execute(sa.delete(models.Secret).where(models.Secret.key == key))
        # Key-level fan-out covers shared credential_specs; per-backend_type call
        # remains as a defense-in-depth backstop.
        await invalidate_backend_cache_for_key(key)
        await invalidate_backend_cache(backend_type)
        return DeleteSandboxCredentialPayload(backend_type=backend_type, key=key, query=Query())
