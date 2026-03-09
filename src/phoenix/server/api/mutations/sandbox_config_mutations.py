import hashlib
import json
import logging
from typing import Any

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.SandboxConfig import (
    CreateSandboxConfigInput,
    SandboxConfig,
    UpdateSandboxConfigInput,
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
    async def create_sandbox_config(
        self,
        info: Info[Context, None],
        input: CreateSandboxConfigInput,
    ) -> SandboxConfig:
        backend_type = input.backend_type.value

        async with info.context.db() as session:
            existing = await session.scalar(
                select(models.SandboxConfig).where(
                    models.SandboxConfig.backend_type == backend_type
                )
            )
            if existing is not None:
                raise BadRequest(f"Sandbox config for backend type '{backend_type}' already exists")

            config = input.config or {}
            row = models.SandboxConfig(
                backend_type=backend_type,
                config=config,
                timeout=input.timeout,
                session_mode=input.session_mode,
                config_hash=compute_sandbox_config_hash(backend_type, input.timeout, config),
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

            if input.config is not None:
                row.config = input.config
            if input.timeout is not None:
                row.timeout = input.timeout
            if input.session_mode is not None:
                row.session_mode = input.session_mode

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
