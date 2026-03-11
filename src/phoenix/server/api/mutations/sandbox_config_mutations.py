import hashlib
import json
import logging
from typing import Any

import strawberry
from sqlalchemy import and_, select
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.SandboxConfig import (
    CreateSandboxAdapterInput,
    CreateSandboxConfigInput,
    SandboxAdapter,
    SandboxBackendType,
    SandboxConfig,
    UpdateSandboxAdapterInput,
    UpdateSandboxConfigInput,
    to_gql_sandbox_adapter,
    to_gql_sandbox_config,
)

logger = logging.getLogger(__name__)


def compute_sandbox_config_hash(backend_type: str, timeout: int, config: dict[str, Any]) -> str:
    """Compute a 16-char hex hash capturing all user-editable sandbox config fields."""
    raw = f"{backend_type}:{timeout}:{json.dumps(config, sort_keys=True)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


@strawberry.type
class SandboxConfigMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_sandbox_adapter(
        self,
        info: Info[Context, None],
        input: CreateSandboxAdapterInput,
    ) -> SandboxAdapter:
        backend_type = input.backend_type.value

        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.SandboxAdapter).where(
                    models.SandboxAdapter.backend_type == backend_type
                )
            )
            if existing is not None:
                raise BadRequest(
                    f"Sandbox adapter for backend type '{backend_type}' already exists"
                )

            config = input.config or {}
            row = models.SandboxAdapter(
                backend_type=backend_type,
                config=config,
                timeout=input.timeout,
                config_hash=compute_sandbox_config_hash(backend_type, input.timeout, config),
            )
            session.add(row)
            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_adapter(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def update_sandbox_adapter(
        self,
        info: Info[Context, None],
        input: UpdateSandboxAdapterInput,
    ) -> SandboxAdapter:
        adapter_id = int(input.id)

        async with info.context.db() as session:
            row = await session.get(models.SandboxAdapter, adapter_id)
            if row is None:
                raise NotFound(f"Sandbox adapter with ID '{adapter_id}' not found")

            if input.config is not None:
                row.config = input.config
            if input.timeout is not None:
                row.timeout = input.timeout

            row.config_hash = compute_sandbox_config_hash(row.backend_type, row.timeout, row.config)

            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_adapter(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_sandbox_adapter(
        self,
        info: Info[Context, None],
        id: strawberry.ID,
    ) -> SandboxAdapter:
        adapter_id = int(id)
        async with info.context.db() as session:
            row = await session.get(models.SandboxAdapter, adapter_id)
            if row is None:
                raise NotFound(f"Sandbox adapter with ID '{adapter_id}' not found")
            result = to_gql_sandbox_adapter(row)
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
    ) -> SandboxAdapter:
        """Enable or disable a specific sandbox backend."""
        async with info.context.db() as session:
            row = await session.scalar(
                select(models.SandboxAdapter).where(
                    models.SandboxAdapter.backend_type == backend_type.value
                )
            )
            if row is None:
                raise NotFound(f"Sandbox adapter for backend type '{backend_type.value}' not found")
            row.enabled = enabled
            await session.flush()
            await session.refresh(row)
            result = to_gql_sandbox_adapter(row)
            await session.commit()
        return result

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def set_sandbox_enabled(
        self,
        info: Info[Context, None],
        enabled: bool,
    ) -> bool:
        """Set the global sandbox enabled/disabled toggle."""
        async with info.context.db() as session:
            settings = await session.get(models.SandboxSettings, 1)
            if settings is None:
                settings = models.SandboxSettings(id=1, enabled=enabled)
                session.add(settings)
            else:
                settings.enabled = enabled
            await session.flush()
        return enabled

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_sandbox_config(
        self,
        info: Info[Context, None],
        input: CreateSandboxConfigInput,
    ) -> SandboxConfig:
        backend_type = input.backend_type.value
        name = input.name
        config = input.config or {}
        timeout = input.timeout if input.timeout is not None else 30

        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.SandboxConfig).where(
                    and_(
                        models.SandboxConfig.backend_type == backend_type,
                        models.SandboxConfig.name == name,
                    )
                )
            )
            if existing is not None:
                raise BadRequest(
                    f"Sandbox config '{name}' for backend '{backend_type}' already exists"
                )

            row = models.SandboxConfig(
                backend_type=backend_type,
                name=name,
                description=input.description,
                config=config,
                timeout=timeout,
                config_hash=compute_sandbox_config_hash(backend_type, timeout, config),
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
                # Check for name uniqueness within the same backend_type
                existing = await session.scalar(
                    select(models.SandboxConfig).where(
                        and_(
                            models.SandboxConfig.backend_type == row.backend_type,
                            models.SandboxConfig.name == input.name,
                            models.SandboxConfig.id != config_id,
                        )
                    )
                )
                if existing is not None:
                    raise BadRequest(
                        f"Sandbox config '{input.name}' for backend "
                        f"'{row.backend_type}' already exists"
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

            row.config_hash = compute_sandbox_config_hash(row.backend_type, row.timeout, row.config)

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
