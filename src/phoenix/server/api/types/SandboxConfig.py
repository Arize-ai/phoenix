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
    DENO = "DENO"


@strawberry.enum
class SandboxBackendStatusCode(Enum):
    AVAILABLE = "AVAILABLE"
    NOT_INSTALLED = "NOT_INSTALLED"
    NEEDS_CREDENTIALS = "NEEDS_CREDENTIALS"
    NEEDS_CONFIG = "NEEDS_CONFIG"


@strawberry.enum
class SandboxLanguage(Enum):
    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"


@strawberry.type
class SandboxBackendStatus:
    backend_type: SandboxBackendType
    status: SandboxBackendStatusCode


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
    supported_languages: list[SandboxLanguage]
    configs: list["SandboxConfig"] = strawberry.field(default_factory=list)


@strawberry.type
class SandboxProvider:
    id: strawberry.ID
    backend_type: SandboxBackendType
    config: JSON
    enabled: bool
    created_at: datetime
    updated_at: datetime


def to_gql_sandbox_provider(row: "models.SandboxProvider") -> "SandboxProvider":
    """Convert a DB SandboxProvider row to the GraphQL SandboxProvider type."""
    return SandboxProvider(
        id=strawberry.ID(str(row.id)),
        backend_type=SandboxBackendType(row.backend_type),
        config=row.config,
        enabled=row.enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@strawberry.type
class SandboxConfig:
    id: strawberry.ID
    provider_id: strawberry.ID
    language_id: strawberry.ID
    name: str
    description: Optional[str]
    config: JSON
    timeout: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


def to_gql_sandbox_config(
    row: "models.SandboxConfig",
) -> "SandboxConfig":
    """Convert a DB SandboxConfig row to the GraphQL SandboxConfig type."""
    return SandboxConfig(
        id=strawberry.ID(str(row.id)),
        provider_id=strawberry.ID(str(row.provider_id)),
        language_id=strawberry.ID(str(row.language_id)),
        name=row.name,
        description=row.description,
        config=row.config,
        timeout=row.timeout,
        enabled=row.enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@strawberry.input
class CreateSandboxProviderInput:
    backend_type: SandboxBackendType
    config: JSON = strawberry.field(default_factory=dict)


@strawberry.input
class UpdateSandboxProviderInput:
    id: strawberry.ID
    config: Optional[JSON] = None


@strawberry.input
class CreateSandboxConfigInput:
    provider_id: strawberry.ID
    language_id: strawberry.ID
    name: str
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None


@strawberry.input
class UpdateSandboxConfigInput:
    id: strawberry.ID
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[JSON] = None
    timeout: Optional[int] = None
    enabled: Optional[bool] = None
