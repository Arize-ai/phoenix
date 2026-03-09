from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput

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
    env_vars: list[SandboxEnvVarSpec]
    config_fields: list[SandboxConfigFieldSpec]
    config_required: bool
    has_session_mode: bool
    setup_instructions: list[str]
    current_config: Optional["SandboxConfig"] = None


@strawberry.type
class SandboxConfig:
    id: strawberry.ID
    backend_type: SandboxBackendType
    config: JSON
    timeout: int
    session_mode: bool
    config_hash: str
    created_at: datetime
    updated_at: datetime


def to_gql_sandbox_config(row: "models.SandboxConfig") -> "SandboxConfig":
    """Convert a DB SandboxConfig row to the GraphQL SandboxConfig type."""
    return SandboxConfig(
        id=strawberry.ID(str(row.id)),
        backend_type=SandboxBackendType(row.backend_type),
        config=row.config,
        timeout=row.timeout,
        session_mode=row.session_mode,
        config_hash=row.config_hash,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@strawberry.input
class CreateSandboxConfigInput:
    backend_type: SandboxBackendType
    config: JSON = strawberry.field(default_factory=dict)
    timeout: int = 30
    session_mode: bool = False
    credentials: Optional[list[GenerativeCredentialInput]] = strawberry.UNSET


@strawberry.input
class UpdateSandboxConfigInput:
    id: strawberry.ID
    config: Optional[JSON] = None
    timeout: Optional[int] = None
    session_mode: Optional[bool] = None
    credentials: Optional[list[GenerativeCredentialInput]] = strawberry.UNSET
