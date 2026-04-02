"""
GraphQL mutations for managing sandbox backend configuration.

Provides CRUD for SandboxConfig rows (named per-provider configs that
CodeEvaluators point to) and update operations for SandboxProvider rows.
"""

import strawberry
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
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


# ---------------------------------------------------------------------------
# Mixin
# ---------------------------------------------------------------------------


@strawberry.type
class SandboxConfigMutationMixin:
    """Mutations for sandbox backend configuration management."""

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
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
            row = models.SandboxConfig(**values)
            session.add(row)
            await session.flush()
            await session.refresh(row)

        return CreateSandboxConfigPayload(
            sandbox_config=to_gql_sandbox_config(row),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
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
                row.config = dict(input.config) if input.config is not None else {}
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
                row.config = dict(input.config) if input.config is not None else {}
            if input.enabled is not strawberry.UNSET and input.enabled is not None:
                row.enabled = input.enabled

            await session.flush()
            await session.refresh(row)

        return UpdateSandboxProviderPayload(
            sandbox_provider=to_gql_sandbox_provider(row),
            query=Query(),
        )
