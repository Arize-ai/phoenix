import logging

import strawberry
from sqlalchemy import and_, select
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.SandboxConfig import (
    CreateSandboxConfigInput,
    CreateSandboxProviderInput,
    SandboxBackendType,
    SandboxConfig,
    SandboxProvider,
    UpdateSandboxConfigInput,
    UpdateSandboxProviderInput,
    to_gql_sandbox_config,
    to_gql_sandbox_provider,
)

logger = logging.getLogger(__name__)


@strawberry.type
class SandboxConfigMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_sandbox_provider(
        self,
        info: Info[Context, None],
        input: CreateSandboxProviderInput,
    ) -> SandboxProvider:
        backend_type = input.backend_type.value

        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.SandboxProvider).where(
                    models.SandboxProvider.backend_type == backend_type
                )
            )
            if existing is not None:
                raise BadRequest(
                    f"Sandbox provider for backend type '{backend_type}' already exists"
                )

            config = input.config or {}
            row = models.SandboxProvider(
                backend_type=backend_type,
                config=config,
            )
            session.add(row)
            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_provider(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def update_sandbox_provider(
        self,
        info: Info[Context, None],
        input: UpdateSandboxProviderInput,
    ) -> SandboxProvider:
        provider_id = int(input.id)

        async with info.context.db() as session:
            row = await session.get(models.SandboxProvider, provider_id)
            if row is None:
                raise NotFound(f"Sandbox provider with ID '{provider_id}' not found")

            if input.config is not None:
                row.config = input.config

            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_provider(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_sandbox_provider(
        self,
        info: Info[Context, None],
        id: strawberry.ID,
    ) -> SandboxProvider:
        provider_id = int(id)
        async with info.context.db() as session:
            row = await session.get(models.SandboxProvider, provider_id)
            if row is None:
                raise NotFound(f"Sandbox provider with ID '{provider_id}' not found")
            result = to_gql_sandbox_provider(row)
            await session.delete(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def set_sandbox_credential(
        self,
        info: Info[Context, None],
        env_var_name: str,
        value: str,
    ) -> bool:
        """Upsert an encrypted credential into the Secret table keyed by env_var_name."""
        from phoenix.db.helpers import SupportedSQLDialect
        from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict

        dialect = SupportedSQLDialect(info.context.db.dialect.name)
        encrypted = info.context.encrypt(value.encode("utf-8"))
        async with info.context.db() as session:
            await session.execute(
                insert_on_conflict(
                    dict(key=env_var_name, value=encrypted),
                    dialect=dialect,
                    table=models.Secret,
                    unique_by=("key",),
                    constraint_name="pk_secrets",
                    on_conflict=OnConflict.DO_UPDATE,
                )
            )
        return True

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_sandbox_credential(
        self,
        info: Info[Context, None],
        env_var_name: str,
    ) -> bool:
        """Delete a credential from the Secret table by env_var_name."""
        import sqlalchemy as sa

        async with info.context.db() as session:
            await session.execute(sa.delete(models.Secret).where(models.Secret.key == env_var_name))
        return True

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def set_sandbox_backend_enabled(
        self,
        info: Info[Context, None],
        backend_type: SandboxBackendType,
        enabled: bool,
    ) -> SandboxProvider:
        """Enable or disable a specific sandbox backend."""
        async with info.context.db() as session:
            row = await session.scalar(
                select(models.SandboxProvider).where(
                    models.SandboxProvider.backend_type == backend_type.value
                )
            )
            if row is None:
                raise NotFound(
                    f"Sandbox provider for backend type '{backend_type.value}' not found"
                )
            row.enabled = enabled
            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_provider(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_sandbox_config(
        self,
        info: Info[Context, None],
        input: CreateSandboxConfigInput,
    ) -> SandboxConfig:
        provider_id = int(input.provider_id)
        language_id = int(input.language_id)
        name = input.name
        config = input.config or {}
        timeout = input.timeout if input.timeout is not None else 30

        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.SandboxConfig).where(
                    and_(
                        models.SandboxConfig.provider_id == provider_id,
                        models.SandboxConfig.name == name,
                    )
                )
            )
            if existing is not None:
                raise BadRequest(
                    f"Sandbox config '{name}' for provider ID '{provider_id}' already exists"
                )

            row = models.SandboxConfig(
                provider_id=provider_id,
                language_id=language_id,
                name=name,
                description=input.description,
                config=config,
                timeout=timeout,
            )
            session.add(row)
            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_config(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def update_sandbox_config(
        self,
        info: Info[Context, None],
        input: UpdateSandboxConfigInput,
    ) -> SandboxConfig:
        config_id = int(input.id)

        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, config_id)
            if row is None:
                raise NotFound(f"Sandbox config with ID '{config_id}' not found")

            if input.name is not None:
                # Check for name uniqueness within the same provider
                existing = await session.scalar(
                    select(models.SandboxConfig).where(
                        and_(
                            models.SandboxConfig.provider_id == row.provider_id,
                            models.SandboxConfig.name == input.name,
                            models.SandboxConfig.id != config_id,
                        )
                    )
                )
                if existing is not None:
                    raise BadRequest(
                        f"Sandbox config '{input.name}' for provider ID "
                        f"'{row.provider_id}' already exists"
                    )
                row.name = input.name
            if input.description is not None:
                row.description = input.description
            if input.config is not None:
                row.config = input.config
            if input.timeout is not None:
                row.timeout = input.timeout
            if input.enabled is not None:
                row.enabled = input.enabled

            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_config(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_sandbox_config(
        self,
        info: Info[Context, None],
        id: strawberry.ID,
    ) -> SandboxConfig:
        config_id = int(id)
        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, config_id)
            if row is None:
                raise NotFound(f"Sandbox config with ID '{config_id}' not found")
            result = to_gql_sandbox_config(row)
            await session.delete(row)
            await session.commit()
        return result
