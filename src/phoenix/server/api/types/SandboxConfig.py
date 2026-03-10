from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

import strawberry
from strawberry.scalars import JSON

if TYPE_CHECKING:
    from phoenix.db import models


@strawberry.enum
class SandboxBackendType(Enum):
    WASM = "WASM"
    E2B = "E2B"
    VERCEL = "VERCEL"
    DAYTONA = "DAYTONA"


@strawberry.enum
class SandboxBackendStatusCode(Enum):
    AVAILABLE = "AVAILABLE"
    NOT_INSTALLED = "NOT_INSTALLED"
    NEEDS_CREDENTIALS = "NEEDS_CREDENTIALS"
    NEEDS_CONFIG = "NEEDS_CONFIG"


@strawberry.type
class SandboxBackendStatus:
    backend_type: SandboxBackendType
    status: SandboxBackendStatusCode
    config_hash: Optional[str] = None


@strawberry.type
class SandboxEnvVarSpec:
    name: str
    required: bool
    description: str


@strawberry.type
class SandboxConfigFieldSpec:
    key: str
    label: str
    placeholder: str
    description: str


@strawberry.type
class SandboxAdapterInfo:
    key: str
    label: str
    description: str
    status: SandboxBackendStatusCode
    enabled: bool
    env_vars: list[SandboxEnvVarSpec]
    config_fields: list[SandboxConfigFieldSpec]
    config_required: bool
    setup_instructions: list[str]
    configs: list["SandboxConfigInstance"] = strawberry.field(default_factory=list)


@strawberry.type
class SandboxConfig:
    id: strawberry.ID
    backend_type: SandboxBackendType
    config: JSON
    timeout: int
    config_hash: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


def to_gql_sandbox_config(row: "models.SandboxConfig") -> "SandboxConfig":
    """Convert a DB SandboxConfig row to the GraphQL SandboxConfig type."""
    return SandboxConfig(
        id=strawberry.ID(str(row.id)),
        backend_type=SandboxBackendType(row.backend_type),
        config=row.config,
        timeout=row.timeout,
        config_hash=row.config_hash,
        enabled=row.enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@strawberry.type
class SandboxConfigInstance:
    id: strawberry.ID
    backend_type: SandboxBackendType
    name: str
    description: Optional[str]
    config: JSON
    timeout: int
    enabled: bool
    config_hash: str
    created_at: datetime
    updated_at: datetime


def to_gql_sandbox_config_instance(
    row: "models.SandboxConfigInstance",
) -> "SandboxConfigInstance":
    """Convert a DB SandboxConfigInstance row to the GraphQL type."""
    return SandboxConfigInstance(
        id=strawberry.ID(str(row.id)),
        backend_type=SandboxBackendType(row.backend_type),
        name=row.name,
        description=row.description,
        config=row.config,
        timeout=row.timeout,
        enabled=row.enabled,
        config_hash=row.config_hash,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@strawberry.input
class CreateSandboxConfigInput:
    backend_type: SandboxBackendType
    config: JSON = strawberry.field(default_factory=dict)
    timeout: int = 30


@strawberry.input
class UpdateSandboxConfigInput:
    id: strawberry.ID
    config: Optional[JSON] = None
    timeout: Optional[int] = None


@strawberry.input
class CreateSandboxConfigInstanceInput:
    backend_type: SandboxBackendType
    name: str
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None


@strawberry.input
class UpdateSandboxConfigInstanceInput:
    id: strawberry.ID
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None
    enabled: Optional[bool] = None
