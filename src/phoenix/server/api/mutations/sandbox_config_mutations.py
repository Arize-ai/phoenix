"""
GraphQL mutations for managing sandbox backend configuration.

Provides CRUD for SandboxConfig rows (named per-provider configs that
CodeEvaluators point to) and update operations for SandboxProvider rows.

The config payload uses a ``@oneOf`` variant: each provider has its own
typed input shape, so the schema expresses both the provider kind and the
set of fields that provider accepts. ``language`` lives inside each variant
because the pydantic config models carry it as part of the stored JSON blob.
"""

from __future__ import annotations

from typing import Any, Optional

import sqlalchemy as sa
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


# ---------------------------------------------------------------------------
# Shared input building blocks. Capability inputs are reused across provider
# variants; each pydantic Config model in ``sandbox/types.py`` composes from
# the same shapes, so one strawberry input per capability is enough.
# ---------------------------------------------------------------------------


@strawberry.input
class EnvVarInput:
    name: str
    secret_key: str

    def to_orm(self) -> EnvVarValue:
        """Build the pydantic ``EnvVarValue`` for this entry (without the name)."""
        return EnvVarValue(secret_key=self.secret_key)


@strawberry.input
class InternetAccessInput:
    mode: InternetAccessChoice

    def to_orm(self) -> InternetAccessConfig:
        return InternetAccessConfig(mode=self.mode.value)


@strawberry.input
class DependenciesInput:
    """Per-language package list. The package syntax (npm vs pip) is enforced
    by the parent Config's model_validator, which reads ``language`` from
    its own field — this leaf doesn't need to know the language."""

    packages: list[str] = strawberry.field(default_factory=list)

    def to_orm(self) -> DependenciesConfig:
        return DependenciesConfig(packages=list(self.packages))


# ---------------------------------------------------------------------------
# Per-provider config inputs. One per adapter Config pydantic model. Fields
# mirror the capability mixins each adapter Config composes from (see
# ``sandbox/types.py``).
# ---------------------------------------------------------------------------


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
    """Deno runs as a local subprocess with no network policy hook, so it
    doesn't carry an ``internet_access`` field. Env vars are still supported."""

    language: Language
    env_vars: list[EnvVarInput] = strawberry.field(default_factory=list)

    def __post_init__(self) -> None:
        _names_are_unique(self.env_vars)

    def to_orm(self) -> DenoConfig:
        fields: dict[str, Any] = {"language": self.language.to_orm()}
        if self.env_vars:
            fields["env_vars"] = {ev.name: ev.to_orm() for ev in self.env_vars}
        return DenoConfig.model_validate(fields)


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
    """WASM accepts no per-config options beyond ``language`` today."""

    language: Language = Language.PYTHON

    def to_orm(self) -> WASMConfig:
        # Route through ``model_validate`` so the ``language: Literal[...]``
        # narrowing on ``WASMConfig`` rejects an unsupported language as a
        # pydantic ValidationError, which the variant ``_convert`` maps to
        # BadRequest. Direct construction would type-error here.
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
    """Config payload, discriminated by provider kind.

    Exactly one variant must be set. ``language`` lives inside each variant
    (mirroring the pydantic Config's ``language`` field), so the input shape
    matches the storage shape exactly.
    """

    e2b: Optional[E2BConfigInput] = strawberry.UNSET
    daytona: Optional[DaytonaConfigInput] = strawberry.UNSET
    deno: Optional[DenoConfigInput] = strawberry.UNSET
    vercel: Optional[VercelConfigInput] = strawberry.UNSET
    wasm: Optional[WASMConfigInput] = strawberry.UNSET
    modal: Optional[ModalConfigInput] = strawberry.UNSET

    def to_orm(self) -> SandboxConfigModel:
        """Return the typed pydantic Config from the selected variant.

        Pure dispatch on the @oneOf variant — pydantic ``ValidationError``
        and friends propagate to the caller. Mutation handlers map
        ``(ValueError, ValidationError, UnsupportedOperation)`` to
        ``BadRequest`` at the GraphQL boundary.

        Language-support is enforced structurally by each Config's
        ``language: Literal[...]`` narrowing — pydantic rejects an
        unsupported language at ``model_validate`` time. No adapter-
        installed check either: configs can be authored before the
        adapter's SDK extra is installed (the operator workflow is
        "configure now, install later"); adapter availability is enforced
        at backend-build time and surfaced as
        ``SandboxBackendStatus.NOT_INSTALLED``.

        Strawberry's ``@oneOf`` enforces exactly-one-set at the schema
        layer; the trailing ``BadRequest`` is a defensive guard against
        schema-bypass paths.
        """
        # ``Optional[X] = strawberry.UNSET`` means the runtime attribute can be
        # ``UNSET`` (not provided), ``None`` (provided as null), or an ``X``
        # instance. Both the ``UNSET`` and ``None`` paths are no-ops.
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


# ---------------------------------------------------------------------------
# Per-provider deployment inputs. Admin-scoped, singleton-per-kind routing
# kwargs (mirroring ``sandbox_providers.config``). Only providers whose SDK
# exposes routing kwargs on ``create()`` appear here — the rest accept no
# deployment input today and are not part of the variant.
# ---------------------------------------------------------------------------


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
    """Deployment payload, discriminated by provider kind.

    Exactly one variant must be set. Only providers with non-trivial routing
    appear here — providers whose SDK has no routing kwargs (WASM, Deno,
    Vercel, Modal) accept no deployment input and are absent from this
    variant. Setting a deployment on those providers is a schema-level
    error.
    """

    daytona: Optional[DaytonaDeploymentInput] = strawberry.UNSET
    e2b: Optional[E2BDeploymentInput] = strawberry.UNSET

    def to_orm(self) -> SandboxDeploymentModel:
        """Return the typed pydantic deployment for the selected variant.

        Pure dispatch — pydantic ``ValidationError`` propagates to the
        caller; the mutation handler maps it to ``BadRequest``. The returned
        model's ``.kind``
        discriminator lets the caller match against the URL-encoded
        ``backend_type``.
        """
        if self.daytona is not None and self.daytona is not strawberry.UNSET:
            return self.daytona.to_orm()
        if self.e2b is not None and self.e2b is not strawberry.UNSET:
            return self.e2b.to_orm()
        raise BadRequest("deployment: exactly one provider variant must be set")


# ---------------------------------------------------------------------------
# Input types
# ---------------------------------------------------------------------------


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
        # ``language`` is read off the validated pydantic Config (which got it
        # from the variant input). Single source of truth.
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
    name: Optional[Identifier] = strawberry.UNSET
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
    sandbox_provider: SandboxProvider
    query: Query


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
        try:
            row = input.to_orm()
        except (ValueError, ValidationError, UnsupportedOperation) as exc:
            raise BadRequest(str(exc))
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
        """Update fields on an existing SandboxConfig."""

        try:
            async with info.context.db() as session:
                row = await session.get(models.SandboxConfig, input.row_id)
                if row is None:
                    raise NotFound(f"SandboxConfig not found: {input.id}")
                if input.name:
                    row.name = input.name
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
                        # ``language`` is row-immutable. Reject mismatched updates the
                        # same way ``kind`` mismatches are rejected.
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
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A sandbox config with that name already exists for this provider")

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
        """Delete a SandboxConfig by GlobalID. Idempotent: missing rows are a no-op."""
        async with info.context.db() as session:
            await session.execute(
                sa.delete(models.SandboxConfig).where(models.SandboxConfig.id == input.row_id)
            )
        return DeleteSandboxConfigPayload(deleted_id=input.id, query=Query())

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def update_sandbox_provider(
        self,
        info: Info[Context, None],
        input: UpdateSandboxProviderInput,
    ) -> UpdateSandboxProviderPayload:
        """Update a sandbox provider's enabled state and/or deployment routing.

        Deployment routing is admin-scoped (singleton per provider kind) and
        validated against the adapter's typed ``deployment_config_model`` via
        the variant-input dispatch — the same validators that fire at read
        time, so blobs cannot be written into a shape that would fail
        re-validation when the backend is built.
        """

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

        return UpdateSandboxProviderPayload(
            sandbox_provider=SandboxProvider(id=row.backend_type, db_record=row),
            query=Query(),
        )
