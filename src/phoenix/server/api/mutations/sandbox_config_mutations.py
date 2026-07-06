"""GraphQL mutations for sandbox backend configuration."""

from __future__ import annotations

from typing import Any, Optional

import strawberry
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import (
    from_global_id_with_expected_type,
    get_sandbox_backend_type_from_global_id,
)
from phoenix.server.api.types.SandboxConfig import (
    InternetAccessChoice,
    Language,
    SandboxConfig,
    SandboxProvider,
)
from phoenix.server.sandbox.types import (
    DaytonaConfig,
    DaytonaDeployment,
    DenoConfig,
    DependenciesConfig,
    E2BConfig,
    E2BDeployment,
    EnvVarValue,
    InternetAccessConfig,
    ModalConfig,
    SandboxConfigModel,
    SandboxDeploymentModel,
    UnsupportedOperation,
    VercelConfig,
    WASMConfig,
)

DEFAULT_SANDBOX_TIMEOUT_SECONDS = 300


@strawberry.input
class EnvVarInput:
    name: str
    secret_key: str

    def to_orm(self) -> EnvVarValue:
        return EnvVarValue(secret_key=self.secret_key)


@strawberry.input
class InternetAccessInput:
    mode: InternetAccessChoice

    def to_orm(self) -> InternetAccessConfig:
        return InternetAccessConfig(mode=self.mode.value)


@strawberry.input
class DependenciesInput:
    packages: list[str] = strawberry.field(default_factory=list)

    def to_orm(self) -> DependenciesConfig:
        return DependenciesConfig(packages=list(self.packages))


def _names_are_unique(env_vars: list[EnvVarInput]) -> None:
    seen: set[str] = set()
    for ev in env_vars:
        if ev.name in seen:
            raise BadRequest(f"Duplicate env var name: {ev.name}")
        seen.add(ev.name)


@strawberry.input
class E2BConfigInput:
    language: Language
    env_vars: list[EnvVarInput] = strawberry.field(default_factory=list)
    internet_access: Optional[InternetAccessInput] = None
    dependencies: Optional[DependenciesInput] = None

    def __post_init__(self) -> None:
        _names_are_unique(self.env_vars)

    def to_orm(self) -> E2BConfig:
        fields: dict[str, Any] = {"language": self.language.to_orm()}
        if self.env_vars:
            fields["env_vars"] = {ev.name: ev.to_orm() for ev in self.env_vars}
        if self.internet_access is not None:
            fields["internet_access"] = self.internet_access.to_orm()
        if self.dependencies is not None:
            fields["dependencies"] = self.dependencies.to_orm()
        return E2BConfig.model_validate(fields)


@strawberry.input
class DaytonaConfigInput:
    language: Language
    env_vars: list[EnvVarInput] = strawberry.field(default_factory=list)
    internet_access: Optional[InternetAccessInput] = None
    dependencies: Optional[DependenciesInput] = None

    def __post_init__(self) -> None:
        _names_are_unique(self.env_vars)

    def to_orm(self) -> DaytonaConfig:
        fields: dict[str, Any] = {"language": self.language.to_orm()}
        if self.env_vars:
            fields["env_vars"] = {ev.name: ev.to_orm() for ev in self.env_vars}
        if self.internet_access is not None:
            fields["internet_access"] = self.internet_access.to_orm()
        if self.dependencies is not None:
            fields["dependencies"] = self.dependencies.to_orm()
        return DaytonaConfig.model_validate(fields)


@strawberry.input
class DenoConfigInput:
    # Deno intentionally has no env-var passthrough or network policy hook.
    language: Language

    def to_orm(self) -> DenoConfig:
        return DenoConfig.model_validate({"language": self.language.to_orm()})


@strawberry.input
class VercelConfigInput:
    language: Language
    env_vars: list[EnvVarInput] = strawberry.field(default_factory=list)
    internet_access: Optional[InternetAccessInput] = None
    dependencies: Optional[DependenciesInput] = None

    def __post_init__(self) -> None:
        _names_are_unique(self.env_vars)

    def to_orm(self) -> VercelConfig:
        fields: dict[str, Any] = {"language": self.language.to_orm()}
        if self.env_vars:
            fields["env_vars"] = {ev.name: ev.to_orm() for ev in self.env_vars}
        if self.internet_access is not None:
            fields["internet_access"] = self.internet_access.to_orm()
        if self.dependencies is not None:
            fields["dependencies"] = self.dependencies.to_orm()
        return VercelConfig.model_validate(fields)


@strawberry.input
class WASMConfigInput:
    language: Language = Language.PYTHON

    def to_orm(self) -> WASMConfig:
        # Routed through model_validate so a Literal[...] language mismatch
        # raises pydantic ValidationError (mapped to BadRequest at the caller).
        return WASMConfig.model_validate({"language": self.language.to_orm()})


@strawberry.input
class ModalConfigInput:
    language: Language = Language.PYTHON
    env_vars: list[EnvVarInput] = strawberry.field(default_factory=list)
    internet_access: Optional[InternetAccessInput] = None
    dependencies: Optional[DependenciesInput] = None

    def __post_init__(self) -> None:
        _names_are_unique(self.env_vars)

    def to_orm(self) -> ModalConfig:
        fields: dict[str, Any] = {"language": self.language.to_orm()}
        if self.env_vars:
            fields["env_vars"] = {ev.name: ev.to_orm() for ev in self.env_vars}
        if self.internet_access is not None:
            fields["internet_access"] = self.internet_access.to_orm()
        if self.dependencies is not None:
            fields["dependencies"] = self.dependencies.to_orm()
        return ModalConfig.model_validate(fields)


@strawberry.input(one_of=True)
class SandboxConfigVariantInput:
    """Config payload, discriminated by provider kind. Exactly one variant must be set."""

    e2b: Optional[E2BConfigInput] = strawberry.UNSET
    daytona: Optional[DaytonaConfigInput] = strawberry.UNSET
    deno: Optional[DenoConfigInput] = strawberry.UNSET
    vercel: Optional[VercelConfigInput] = strawberry.UNSET
    wasm: Optional[WASMConfigInput] = strawberry.UNSET
    modal: Optional[ModalConfigInput] = strawberry.UNSET

    def to_orm(self) -> SandboxConfigModel:
        if self.e2b is not None and self.e2b is not strawberry.UNSET:
            return self.e2b.to_orm()
        if self.daytona is not None and self.daytona is not strawberry.UNSET:
            return self.daytona.to_orm()
        if self.deno is not None and self.deno is not strawberry.UNSET:
            return self.deno.to_orm()
        if self.vercel is not None and self.vercel is not strawberry.UNSET:
            return self.vercel.to_orm()
        if self.wasm is not None and self.wasm is not strawberry.UNSET:
            return self.wasm.to_orm()
        if self.modal is not None and self.modal is not strawberry.UNSET:
            return self.modal.to_orm()
        raise BadRequest("config: exactly one provider variant must be set")


@strawberry.input
class DaytonaDeploymentInput:
    api_url: Optional[str] = None
    target: Optional[str] = None

    def to_orm(self) -> DaytonaDeployment:
        return DaytonaDeployment.model_validate({"api_url": self.api_url, "target": self.target})


@strawberry.input
class E2BDeploymentInput:
    domain: Optional[str] = None
    api_url: Optional[str] = None

    def to_orm(self) -> E2BDeployment:
        return E2BDeployment.model_validate({"domain": self.domain, "api_url": self.api_url})


@strawberry.input(one_of=True)
class SandboxDeploymentVariantInput:
    """Deployment payload, discriminated by provider kind. Exactly one variant must be set.

    Providers whose SDK has no routing kwargs (WASM, Deno, Vercel, Modal) are
    absent from this variant.
    """

    daytona: Optional[DaytonaDeploymentInput] = strawberry.UNSET
    e2b: Optional[E2BDeploymentInput] = strawberry.UNSET

    def to_orm(self) -> SandboxDeploymentModel:
        if self.daytona is not None and self.daytona is not strawberry.UNSET:
            return self.daytona.to_orm()
        if self.e2b is not None and self.e2b is not strawberry.UNSET:
            return self.e2b.to_orm()
        raise BadRequest("deployment: exactly one provider variant must be set")


@strawberry.input
class CreateSandboxConfigInput:
    config: SandboxConfigVariantInput
    name: Identifier
    description: Optional[str] = None
    timeout: Optional[int] = None
    enabled: bool = True

    def __post_init__(self) -> None:
        if isinstance(self.timeout, int) and self.timeout <= 0:
            raise BadRequest("timeout must be a positive integer")

    def to_orm(self) -> models.SandboxConfig:
        validated = self.config.to_orm()
        return models.SandboxConfig(
            backend_type=validated.backend_type,
            language=validated.language,
            name=self.name,
            description=self.description,
            config=validated.model_dump(mode="json", exclude_none=True),
            timeout=self.timeout if self.timeout is not None else DEFAULT_SANDBOX_TIMEOUT_SECONDS,
            enabled=self.enabled,
        )


@strawberry.input
class UpdateSandboxConfigInput:
    id: GlobalID
    description: Optional[str] = strawberry.UNSET
    config: Optional[SandboxConfigVariantInput] = strawberry.UNSET
    timeout: Optional[int] = strawberry.UNSET
    enabled: Optional[bool] = strawberry.UNSET

    @property
    def row_id(self) -> int:
        return from_global_id_with_expected_type(self.id, expected_type_name=SandboxConfig.__name__)

    def __post_init__(self) -> None:
        if isinstance(self.timeout, int) and self.timeout <= 0:
            raise BadRequest("timeout must be a positive integer")


@strawberry.input
class UpdateSandboxProviderInput:
    id: GlobalID
    enabled: Optional[bool] = strawberry.UNSET
    deployment: Optional[SandboxDeploymentVariantInput] = strawberry.UNSET

    @property
    def backend_type(self) -> models.SandboxBackendType:
        return get_sandbox_backend_type_from_global_id(self.id)


@strawberry.input
class DeleteSandboxConfigInput:
    id: GlobalID

    @property
    def row_id(self) -> int:
        return from_global_id_with_expected_type(self.id, expected_type_name=SandboxConfig.__name__)


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
    sandbox_provider: SandboxProvider
    query: Query


@strawberry.type
class SandboxConfigMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def create_sandbox_config(
        self,
        info: Info[Context, None],
        input: CreateSandboxConfigInput,
    ) -> CreateSandboxConfigPayload:
        try:
            row = input.to_orm()
        except (ValueError, ValidationError, UnsupportedOperation) as exc:
            raise BadRequest(str(exc))
        row.user_id = info.context.user_id
        try:
            async with info.context.db() as session:
                session.add(row)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict(
                f"A sandbox config with name {input.name.root!r} already exists for this provider"
            )

        return CreateSandboxConfigPayload(
            sandbox_config=SandboxConfig(id=row.id, db_record=row),
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
        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, input.row_id)
            if row is None:
                raise NotFound(f"SandboxConfig not found: {input.id}")
            if input.description is not strawberry.UNSET:
                row.description = input.description
            if input.config is not strawberry.UNSET and input.config is not None:
                try:
                    validated = input.config.to_orm()
                except (ValueError, ValidationError, UnsupportedOperation) as exc:
                    raise BadRequest(str(exc))
                if validated.backend_type != row.backend_type:
                    raise BadRequest(
                        f"Config variant {validated.backend_type!r} does not match existing "
                        f"row provider kind {row.backend_type!r}; recreate the config "
                        "to change provider."
                    )
                if validated.language != row.language:
                    # language is row-immutable.
                    raise BadRequest(
                        f"Config language {validated.language!r} does not match "
                        f"existing row language {row.language!r}; language is "
                        "row-immutable and cannot be changed via update."
                    )
                row.config = validated.model_dump(mode="json", exclude_none=True)
            if isinstance(input.timeout, int) and input.timeout > 0:
                row.timeout = input.timeout
            if isinstance(input.enabled, bool):
                row.enabled = input.enabled
            row.user_id = info.context.user_id

        return UpdateSandboxConfigPayload(
            sandbox_config=SandboxConfig(id=row.id, db_record=row),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def delete_sandbox_config(
        self,
        info: Info[Context, None],
        input: DeleteSandboxConfigInput,
    ) -> DeleteSandboxConfigPayload:
        """Delete a SandboxConfig by GlobalID. Idempotent: missing rows are a no-op.

        Built-in defaults (rows the startup seeder owns) cannot be deleted: the
        seeder would recreate them on the next restart, so deletion is refused
        and the operator is steered to disable the row instead.
        """
        from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA  # noqa: PLC0415
        from phoenix.server.sandbox.sync import is_seeded_default_config  # noqa: PLC0415

        async with info.context.db() as session:
            row = await session.get(models.SandboxConfig, input.row_id)
            if row is not None:
                if is_seeded_default_config(row, SANDBOX_ADAPTER_METADATA):
                    raise Conflict(
                        f"Sandbox config {row.name.root!r} is a built-in default and cannot "
                        "be deleted; disable it instead (set enabled to false)."
                    )
                await session.delete(row)
        return DeleteSandboxConfigPayload(deleted_id=input.id, query=Query())

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def update_sandbox_provider(
        self,
        info: Info[Context, None],
        input: UpdateSandboxProviderInput,
    ) -> UpdateSandboxProviderPayload:
        backend_type = input.backend_type
        async with info.context.db() as session:
            row = await session.get(models.SandboxProvider, backend_type)
            if row is None:
                raise NotFound(f"SandboxProvider not found: {backend_type}")

            if isinstance(input.enabled, bool):
                row.enabled = input.enabled

            if input.deployment is not strawberry.UNSET:
                if input.deployment is None:
                    row.config = {}
                else:
                    try:
                        validated = input.deployment.to_orm()
                    except (ValueError, ValidationError, UnsupportedOperation) as exc:
                        raise BadRequest(str(exc))
                    if validated.backend_type != backend_type:
                        raise BadRequest(
                            f"Deployment variant {validated.backend_type!r} does not match "
                            f"provider kind {backend_type!r}; the variant must "
                            "match the provider being updated."
                        )
                    row.config = validated.model_dump(mode="json", exclude_none=True)

            row.user_id = info.context.user_id

        return UpdateSandboxProviderPayload(
            sandbox_provider=SandboxProvider(id=row.backend_type, db_record=row),
            query=Query(),
        )
