from datetime import datetime
from enum import Enum
from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput


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
