"""Shared evaluator definitions, versions, context, and validation operations."""

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Callable, Literal, Optional, Sequence, Union, cast, overload

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import code_evaluator_with_latest_version
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    CategoricalOutputConfig,
    OutputConfigType,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.prompts.validation import validate_custom_provider
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.evaluators.input_descriptions import (
    apply_code_input_schema,
    apply_llm_input_schema,
)
from phoenix.server.evaluators.services.management import (
    EVALUATOR_TYPENAME_BY_KIND,
    ensure_evaluator_prompt_label,
    raise_on_uninferable_evaluate_signature,
    release_evaluator_prompt_label,
    release_llm_evaluator_prompt,
    validate_code_evaluator_sandbox_config,
)
from phoenix.server.evaluators.services.prompt_source import (
    CreatePromptSource,
    FromPromptVersion,
    NewPrompt,
    UpdatePromptSource,
    get_prompt_version,
    pin_prompt_version,
    resolve_evaluator_prompt_version,
)
from phoenix.server.evaluators.services.purge import purge_deleted_bindings_of_evaluator
from phoenix.server.evaluators.validation import (
    require_categorical_output_configs,
)
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory


@dataclass(kw_only=True)
class EvaluatorServiceContext:
    db: DbSessionFactory
    sandbox_runtime: SandboxRuntimeContext
    user_id: int | None = None
    wake_evaluator_purger: Callable[[], None] = lambda: None


def require_output_configs(configs: list[OutputConfigType]) -> None:
    """Reject an empty or name-repeating list of output configs.

    A run records its results under its output configs, so a definition needs at least one,
    and a binding that uses its evaluator's configs stores NULL rather than an empty override.
    """
    if not configs:
        raise BadRequest("At least one output config is required.")
    names = [config.name for config in configs]
    if len(names) != len(set(names)):
        raise BadRequest("Output config names must be unique")


@overload
def check_output_configs(
    kind: Literal["LLM"], configs: Optional[Sequence[OutputConfigType]]
) -> list[CategoricalOutputConfig]: ...
@overload
def check_output_configs(
    kind: Literal["CODE", "BUILTIN"], configs: Optional[Sequence[OutputConfigType]]
) -> list[OutputConfigType]: ...
def check_output_configs(
    kind: Literal["LLM", "CODE", "BUILTIN"], configs: Optional[Sequence[OutputConfigType]]
) -> Union[list[CategoricalOutputConfig], list[OutputConfigType]]:
    """Check the output configs of a definition or a binding's override for an evaluator of
    this kind, and return them typed for it. A missing list counts as empty."""
    checked = list(configs or [])
    if kind == "LLM":
        try:
            require_categorical_output_configs(checked)
        except ValueError as error:
            raise BadRequest(str(error)) from error
    require_output_configs(checked)
    if kind == "LLM":
        return cast(list[CategoricalOutputConfig], checked)
    return checked


@dataclass(frozen=True)
class ValidatedCode:
    """Source code and the sandbox that accepted it, checked before the write that stores
    them. A sandbox of None means none was chosen, so nothing ran the code."""

    source_code: str
    language: models.LanguageName
    sandbox_config_id: Optional[int]


async def preflight_code(
    context: EvaluatorServiceContext,
    *,
    source_code: str,
    language: models.LanguageName,
    sandbox_config_id: Optional[GlobalID],
    action: str,
    new_source: bool = True,
) -> ValidatedCode:
    """Run code through its sandbox before the write transaction, so no database lock is
    held while the sandbox works. New source must also declare inferable `evaluate` inputs,
    which is checked first."""
    if new_source:
        raise_on_uninferable_evaluate_signature(source_code, language)
    validated_sandbox_config_id: Optional[int] = None
    if sandbox_config_id is not None:
        validated_sandbox_config_id = await validate_code_evaluator_sandbox_config(
            context.db,
            sandbox_config_global_id=sandbox_config_id,
            language=language,
            action=action,
            source_code=source_code,
            sandbox_runtime=context.sandbox_runtime,
        )
    return ValidatedCode(
        source_code=source_code,
        language=language,
        sandbox_config_id=validated_sandbox_config_id,
    )


async def create_code_definition(
    session: AsyncSession,
    *,
    name: Identifier,
    code: ValidatedCode,
    input_mapping: InputMapping,
    output_configs: list[OutputConfigType],
    user_id: Optional[int],
    description: Optional[str] = None,
    input_schema: Any = None,
) -> models.CodeEvaluator:
    """Create a code definition with its first version in the caller's transaction."""
    evaluator = models.CodeEvaluator(
        name=name,
        description=description,
        language=code.language,
        user_id=user_id,
        sandbox_config_id=code.sandbox_config_id,
        input_mapping=input_mapping,
        output_configs=cast(list[AnnotationConfigType], output_configs),
    )
    try:
        apply_code_input_schema(evaluator, code.source_code, input_schema)
    except ValueError as error:
        raise BadRequest(str(error))
    session.add(evaluator)
    await session.flush()
    session.add(
        models.CodeEvaluatorVersion(
            code_evaluator_id=evaluator.id,
            source_code=code.source_code,
            user_id=user_id,
        )
    )
    await session.flush()
    return evaluator


@dataclass(frozen=True)
class CodeDefinitionUpdate:
    """What an edit did: the version the evaluator runs after it, whether the edit appended
    that version, and whether it changed the definition at all."""

    version: Optional[models.CodeEvaluatorVersion]
    appended: bool
    changed: bool


async def update_code_definition(
    session: AsyncSession,
    evaluator: models.CodeEvaluator,
    *,
    user_id: Optional[int],
    source_code: str = UNSET,
    description: Optional[str] = UNSET,
    sandbox_config_id: Optional[int] = UNSET,
    input_mapping: InputMapping = UNSET,
    output_configs: list[OutputConfigType] = UNSET,
    input_schema: Any = UNSET,
) -> CodeDefinitionUpdate:
    """Apply a definition edit in the caller's transaction. UNSET fields keep their values.

    Source that differs from the current version is appended as a new version. When the
    source or `input_schema` is given, the input descriptions follow the parameters of the
    code the evaluator runs after the edit."""
    latest = await code_evaluator_with_latest_version(session, evaluator.id)
    version = latest[1] if latest is not None else None
    changed = False
    if description is not UNSET and evaluator.description != description:
        evaluator.description = description
        changed = True
    if sandbox_config_id is not UNSET and evaluator.sandbox_config_id != sandbox_config_id:
        evaluator.sandbox_config_id = sandbox_config_id
        changed = True
    if input_mapping is not UNSET and evaluator.input_mapping != input_mapping:
        evaluator.input_mapping = input_mapping
        changed = True
    if output_configs is not UNSET and evaluator.output_configs != output_configs:
        evaluator.output_configs = cast(list[AnnotationConfigType], output_configs)
        changed = True
    appended = False
    if source_code is not UNSET:
        candidate = models.CodeEvaluatorVersion(
            code_evaluator_id=evaluator.id,
            source_code=source_code,
            user_id=user_id,
        )
        if version is None or not version.has_identical_content(candidate):
            session.add(candidate)
            version = candidate
            appended = changed = True
    if source_code is not UNSET or input_schema is not UNSET:
        try:
            if apply_code_input_schema(
                evaluator, version.source_code if version is not None else "", input_schema
            ):
                changed = True
        except ValueError as error:
            raise BadRequest(str(error))
    await session.flush()
    return CodeDefinitionUpdate(version=version, appended=appended, changed=changed)


@dataclass(kw_only=True)
class PatchCodeEvaluatorInput:
    id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class CreateCodeEvaluatorInput:
    name: Identifier
    source_code: str
    language: models.LanguageName
    sandbox_config_id: GlobalID
    input_mapping: InputMapping
    output_configs: list[OutputConfigType]
    description: Optional[str] = None
    input_schema: Any = None  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class CreateCodeEvaluatorVersionInput:
    code_evaluator_id: GlobalID
    source_code: str
    expected_current_version_id: Optional[GlobalID] = None
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service

    def changes_configuration(self) -> bool:
        return any(
            value is not UNSET
            for value in (
                self.description,
                self.sandbox_config_id,
                self.input_mapping,
                self.output_configs,
                self.input_schema,
            )
        )


async def patch_code_evaluator(
    context: EvaluatorServiceContext, input: PatchCodeEvaluatorInput
) -> models.CodeEvaluator:
    """Patch a shared code definition while preserving its immutable source versions."""
    try:
        evaluator_id = from_global_id_with_expected_type(
            global_id=input.id, expected_type_name="CodeEvaluator"
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error

    input_mapping = input.input_mapping
    if input_mapping is None:
        raise BadRequest("input_mapping cannot be set to null")
    if input.output_configs is not UNSET and input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    output_configs = (
        check_output_configs("CODE", input.output_configs)
        if input.output_configs is not UNSET
        else UNSET
    )

    validated: Optional[ValidatedCode] = None
    if input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None:
        async with context.db() as session:
            code_evaluator_with_version = await code_evaluator_with_latest_version(
                session, evaluator_id
            )
            if code_evaluator_with_version is None:
                raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
            current, current_version = code_evaluator_with_version
        validated = await preflight_code(
            context,
            source_code=current_version.source_code if current_version else "",
            language=current.language,
            sandbox_config_id=input.sandbox_config_id,
            action="patching this evaluator",
            new_source=False,
        )

    try:
        async with context.db() as session:
            code_evaluator_with_version = await code_evaluator_with_latest_version(
                session, evaluator_id
            )
            if code_evaluator_with_version is None:
                raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
            row, current_version = code_evaluator_with_version

            if input.name is not UNSET and input.name is not None:
                try:
                    row.name = Identifier.model_validate(input.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}")

            sandbox_config_id: Optional[int] = UNSET
            if input.sandbox_config_id is None:
                sandbox_config_id = None
            elif validated is not None:
                latest_source_code = (
                    current_version.source_code if current_version is not None else ""
                )
                if latest_source_code != validated.source_code:
                    raise Conflict(
                        "The evaluator version changed during sandbox validation; retry.",
                        reason="concurrent_change",
                    )
                sandbox_config_id = validated.sandbox_config_id

            await update_code_definition(
                session,
                row,
                user_id=context.user_id,
                description=input.description,
                sandbox_config_id=sandbox_config_id,
                input_mapping=input_mapping,
                output_configs=output_configs,
                input_schema=input.input_schema,
            )
            # The row is returned to resolvers after the session closes, so load the
            # server-generated updated_at now instead of leaving it expired.
            await session.refresh(row, attribute_names=["updated_at"])

    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        if input.name is not UNSET and input.name is not None:
            raise await evaluator_name_taken(context, input.name) from error
        raise Conflict(
            "Could not update the evaluator because of a conflicting resource"
        ) from error

    return row


async def create_code_evaluator(
    context: EvaluatorServiceContext, input: CreateCodeEvaluatorInput
) -> models.CodeEvaluator:
    """Create a standalone code definition with its first version; nothing binds it yet."""
    try:
        validated_name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    output_configs = check_output_configs("CODE", input.output_configs)
    code = await preflight_code(
        context,
        source_code=input.source_code,
        language=input.language,
        sandbox_config_id=input.sandbox_config_id,
        action="creating this evaluator",
    )
    try:
        async with context.db() as session:
            row = await create_code_definition(
                session,
                name=validated_name,
                code=code,
                input_mapping=input.input_mapping,
                output_configs=output_configs,
                user_id=context.user_id,
                description=input.description,
                input_schema=input.input_schema,
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await evaluator_name_taken(context, input.name) from error
    return row


async def evaluator_name_taken(
    context: EvaluatorServiceContext, name: Union[str, Identifier]
) -> Conflict:
    """The error for a create whose name another evaluator already holds."""
    name = name.root if isinstance(name, Identifier) else name
    async with context.db() as session:
        existing = (
            await session.execute(
                select(models.Evaluator.id, models.Evaluator.kind).where(
                    models.Evaluator.name == Identifier.model_validate(name)
                )
            )
        ).one_or_none()
    if existing is None:
        return Conflict(f"Could not create evaluator '{name}' because of a conflicting resource")
    row_id, kind = existing
    return AlreadyExists(
        f"An evaluator named '{name}' already exists",
        existing_id=str(GlobalID(EVALUATOR_TYPENAME_BY_KIND[kind], str(row_id))),
    )


@dataclass(kw_only=True)
class CreateLLMEvaluatorInput:
    name: Identifier
    prompt_version_id: GlobalID
    output_configs: list[OutputConfigType]
    description: Optional[str] = None
    input_schema: Any = None  # a JSON schema object, parsed by the service


async def create_llm_definition(
    session: AsyncSession,
    *,
    name: Identifier,
    prompt_source: CreatePromptSource,
    output_configs: list[CategoricalOutputConfig],
    user_id: Optional[int],
    description: Optional[str] = None,
    input_schema: Any = None,
    binding_name: Optional[Identifier] = None,
) -> models.LLMEvaluator:
    """Create an LLM definition in the caller's transaction, pinned by a tag it owns to the
    version its prompt source names. A create-and-attach passes the binding's name, which
    names the new prompt and the tag in place of the definition's possibly suffixed name."""
    naming = binding_name or name
    content = prompt_source.content
    if content is not None:
        content.user_id = user_id
        await validate_custom_provider(session, content)
    if isinstance(prompt_source, FromPromptVersion):
        base = await get_prompt_version(session, prompt_source.prompt_version_id)
        prompt_version = await pin_prompt_version(
            session, base=base, content=content, prompt_id=base.prompt_id
        )
    else:
        prompt_version = await _new_evaluator_prompt(
            session, prompt_source.content, name=naming, description=description
        )
    evaluator = models.LLMEvaluator(
        name=name,
        description=description,
        kind="LLM",
        output_configs=output_configs,
        user_id=user_id,
        prompt_id=prompt_version.prompt_id,
    )
    try:
        apply_llm_input_schema(evaluator, prompt_version, input_schema)
    except ValueError as error:
        raise BadRequest(str(error))
    session.add(evaluator)
    await session.flush()
    await ensure_evaluator_prompt_label(session, prompt_version.prompt_id)
    evaluator.prompt_version_tag = _evaluator_tag(naming, prompt_version)
    await session.flush()
    return evaluator


async def _new_evaluator_prompt(
    session: AsyncSession,
    content: models.PromptVersion,
    *,
    name: Identifier,
    description: Optional[str],
) -> models.PromptVersion:
    prompt = models.Prompt(
        name=Identifier.model_validate(f"{name}-evaluator-{token_hex(4)}"),
        description=description,
        prompt_versions=[content],
    )
    session.add(prompt)
    await session.flush()
    return content


def _evaluator_tag(name: Identifier, version: models.PromptVersion) -> models.PromptVersionTag:
    return models.PromptVersionTag(
        name=Identifier.model_validate(f"{name}-evaluator-{token_hex(4)}"),
        prompt_id=version.prompt_id,
        prompt_version_id=version.id,
    )


async def create_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateLLMEvaluatorInput
) -> models.LLMEvaluator:
    """Create a standalone LLM definition that runs an existing prompt version, pinned by
    a tag the evaluator owns; nothing binds it yet."""
    try:
        name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(str(error))
    output_configs = check_output_configs("LLM", input.output_configs)
    try:
        async with context.db() as session:
            evaluator = await create_llm_definition(
                session,
                name=name,
                prompt_source=FromPromptVersion(prompt_version_id=input.prompt_version_id),
                output_configs=output_configs,
                user_id=context.user_id,
                description=input.description,
                input_schema=input.input_schema,
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await evaluator_name_taken(context, input.name) from error
    return evaluator


async def delete_llm_evaluator(context: EvaluatorServiceContext, evaluator_id: GlobalID) -> None:
    """Delete an LLM definition nothing binds, with the tag that pins its version; the
    prompt is kept. A bound definition is refused with Conflict."""
    try:
        row_id = from_global_id_with_expected_type(evaluator_id, "LLMEvaluator")
    except ValueError as error:
        raise BadRequest(str(error)) from error
    await purge_deleted_bindings_of_evaluator(context.db, row_id)
    async with context.db() as session:
        row = await session.get(models.LLMEvaluator, row_id, with_for_update=True)
        if row is None:
            return
        await refuse_bound_evaluator(session, row_id, evaluator_id)
        prompt_id, tag_id = row.prompt_id, row.prompt_version_tag_id
        await session.delete(row)
        await session.flush()
        await release_llm_evaluator_prompt(
            session, prompt_version_tag_id=tag_id, prompt_id=prompt_id
        )


async def refuse_bound_evaluator(
    session: AsyncSession, row_id: int, evaluator_id: GlobalID
) -> None:
    project_bindings, deleted_project_bindings = await _count_bindings(
        session, models.ProjectEvaluator, row_id
    )
    dataset_bindings, deleted_dataset_bindings = await _count_bindings(
        session, models.DatasetEvaluators, row_id
    )
    if project_bindings or dataset_bindings:
        raise Conflict(
            f"Evaluator {evaluator_id} is still bound by {project_bindings} project and "
            f"{dataset_bindings} dataset bindings; delete those bindings first",
            reason="still_bound",
            binding_counts={"project": project_bindings, "dataset": dataset_bindings},
        )
    # Deleting the definition would cascade to these bindings before their trace projects
    # are purged, leaving those projects behind.
    if deleted_project_bindings or deleted_dataset_bindings:
        raise Conflict(
            f"Evaluator {evaluator_id} has bindings that are still being deleted; retry shortly",
            reason="bindings_being_deleted",
        )


async def _count_bindings(
    session: AsyncSession,
    model: type[models.DatasetEvaluators] | type[models.ProjectEvaluator],
    evaluator_id: int,
) -> tuple[int, int]:
    """How many of the evaluator's bindings are live and how many are deleted."""
    live, deleted = (
        await session.execute(
            select(
                func.count(model.id).filter(model.deleted_at.is_(None)),
                func.count(model.id).filter(model.deleted_at.is_not(None)),
            ).where(model.evaluator_id == evaluator_id)
        )
    ).one()
    return live, deleted


async def delete_code_evaluator(context: EvaluatorServiceContext, evaluator_id: GlobalID) -> None:
    """Delete a code definition nothing binds; a bound definition is refused with Conflict."""
    try:
        row_id = from_global_id_with_expected_type(evaluator_id, "CodeEvaluator")
    except ValueError as error:
        raise BadRequest(str(error)) from error
    await purge_deleted_bindings_of_evaluator(context.db, row_id)
    async with context.db() as session:
        row = await session.get(models.CodeEvaluator, row_id, with_for_update=True)
        if row is None:
            return
        await refuse_bound_evaluator(session, row_id, evaluator_id)
        await session.delete(row)


def _check_expected_version(
    input: CreateCodeEvaluatorVersionInput, current_version: Optional[models.CodeEvaluatorVersion]
) -> None:
    if input.expected_current_version_id is None:
        return
    try:
        expected = from_global_id_with_expected_type(
            input.expected_current_version_id, "CodeEvaluatorVersion"
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error
    actual = current_version.id if current_version is not None else None
    if actual != expected:
        current_version_id = (
            str(GlobalID("CodeEvaluatorVersion", str(actual))) if actual is not None else None
        )
        current_description = (
            f"is {current_version_id}" if current_version_id is not None else "has no version yet"
        )
        raise Conflict(
            f"The evaluator's current version {current_description}, not the expected "
            f"{input.expected_current_version_id}; re-read the evaluator and reconcile "
            "before retrying",
            reason="version_mismatch",
            current_version_id=current_version_id,
        )


async def create_code_evaluator_version(
    context: EvaluatorServiceContext, input: CreateCodeEvaluatorVersionInput
) -> tuple[models.CodeEvaluator, models.CodeEvaluatorVersion, bool]:
    """Append code and, in the same transaction, any configuration the new code needs.

    Returns the evaluator, the persisted version, and whether a version was appended.
    Configuration fields left UNSET keep their values. A caller that passes
    expected_current_version_id is refused with Conflict when another deployment landed
    in between, so deployments do not silently reactivate older source.
    """
    try:
        evaluator_id = from_global_id_with_expected_type(
            global_id=input.code_evaluator_id, expected_type_name="CodeEvaluator"
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error
    input_mapping = input.input_mapping
    if input_mapping is None:
        raise BadRequest("input_mapping cannot be set to null")
    if input.output_configs is not UNSET and input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    output_configs = (
        check_output_configs("CODE", input.output_configs)
        if input.output_configs is not UNSET
        else UNSET
    )

    async with context.db() as session:
        code_evaluator_with_version = await code_evaluator_with_latest_version(
            session, evaluator_id
        )
        if code_evaluator_with_version is None:
            raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
        current, current_version = code_evaluator_with_version
        _check_expected_version(input, current_version)
        source_unchanged = (
            current_version is not None and current_version.source_code == input.source_code
        )
        if source_unchanged and not input.changes_configuration():
            assert current_version is not None
            return current, current_version, False
        validated_current_version_id = current_version.id if current_version is not None else None
        if input.sandbox_config_id is UNSET:
            target_sandbox_config_id = current.sandbox_config_id
        elif input.sandbox_config_id is None:
            target_sandbox_config_id = None
        else:
            try:
                target_sandbox_config_id = from_global_id_with_expected_type(
                    input.sandbox_config_id, "SandboxConfig"
                )
            except ValueError as error:
                raise BadRequest(str(error)) from error

    code = await preflight_code(
        context,
        source_code=input.source_code,
        language=current.language,
        sandbox_config_id=(
            GlobalID("SandboxConfig", str(target_sandbox_config_id))
            if target_sandbox_config_id is not None
            else None
        ),
        action="creating this evaluator version",
    )

    try:
        async with context.db() as session:
            # Deploys of one evaluator serialize on its row, so the expected version is
            # compared with the committed tip rather than one a concurrent deploy replaces.
            await session.get(models.CodeEvaluator, evaluator_id, with_for_update=True)
            code_evaluator_with_version = await code_evaluator_with_latest_version(
                session, evaluator_id
            )
            if code_evaluator_with_version is None:
                raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
            row, current_version = code_evaluator_with_version
            _check_expected_version(input, current_version)
            if row.language != code.language:
                raise Conflict(
                    "The evaluator language changed during source validation; retry.",
                    reason="concurrent_change",
                )
            if (
                current_version.id if current_version is not None else None
            ) != validated_current_version_id:
                if current_version is None or current_version.source_code != code.source_code:
                    raise Conflict(
                        "The evaluator version changed during source validation; retry.",
                        reason="concurrent_change",
                    )
            if input.sandbox_config_id is UNSET and row.sandbox_config_id != code.sandbox_config_id:
                raise Conflict(
                    "The evaluator sandbox changed during source validation; retry.",
                    reason="concurrent_change",
                )
            sandbox_config_id: Optional[int] = UNSET
            if input.sandbox_config_id is not UNSET:
                sandbox_config_id = code.sandbox_config_id
            update = await update_code_definition(
                session,
                row,
                user_id=context.user_id,
                source_code=code.source_code,
                description=input.description,
                sandbox_config_id=sandbox_config_id,
                input_mapping=input_mapping,
                output_configs=output_configs,
                input_schema=input.input_schema,
            )
            version = update.version
            assert version is not None
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        raise Conflict(
            "Could not create the code evaluator version because of a conflicting resource"
        ) from e

    return row, version, update.appended


async def update_llm_definition(
    session: AsyncSession,
    evaluator: models.LLMEvaluator,
    *,
    prompt_source: Optional[UpdatePromptSource],
    output_configs: list[CategoricalOutputConfig],
    description: Optional[str],
    name: Identifier,
    user_id: int | None,
    shared_evaluator_changed: bool = False,
    input_schema: Any = UNSET,
) -> None:
    """Apply a definition edit. Without a prompt source the evaluator keeps running what it
    runs: its pinned version, or, for an evaluator without a pin, its prompt's newest version,
    which stays unpinned. `NewPrompt` moves the evaluator onto a new prompt holding the
    content. `input_schema` describes the prompt's variables; UNSET keeps the stored
    descriptions for the variables the prompt still names, and None clears them. A deleted
    tag is recreated whenever the edit names a version."""
    base: Optional[models.PromptVersion] = None
    keeps_following_latest = prompt_source is None and evaluator.prompt_version_tag_id is None
    content = prompt_source.content if prompt_source is not None else None
    if content is not None:
        content.user_id = user_id
    if isinstance(prompt_source, NewPrompt):
        await validate_custom_provider(session, prompt_source.content)
        prompt_version = await _new_evaluator_prompt(
            session, prompt_source.content, name=name, description=description or None
        )
    else:
        if isinstance(prompt_source, FromPromptVersion):
            base = await get_prompt_version(session, prompt_source.prompt_version_id)
        elif evaluator.prompt_version_tag_id is not None or keeps_following_latest:
            base = await resolve_evaluator_prompt_version(session, evaluator)
        if content is not None:
            await validate_custom_provider(session, content)
        prompt_version = await pin_prompt_version(
            session,
            base=base,
            content=content,
            prompt_id=base.prompt_id if base is not None else evaluator.prompt_id,
        )
    if prompt_version is not base:
        shared_evaluator_changed = True
    target_prompt_id = prompt_version.prompt_id

    if description is not UNSET and evaluator.description != description:
        evaluator.description = description
        shared_evaluator_changed = True
    if evaluator.output_configs != output_configs:
        evaluator.output_configs = output_configs
        shared_evaluator_changed = True
    if evaluator.prompt_id != target_prompt_id:
        previous_prompt_id = evaluator.prompt_id
        evaluator.prompt_id = target_prompt_id
        shared_evaluator_changed = True
        await ensure_evaluator_prompt_label(session, target_prompt_id)
        await release_evaluator_prompt_label(session, previous_prompt_id)
    try:
        if apply_llm_input_schema(evaluator, prompt_version, input_schema):
            shared_evaluator_changed = True
    except ValueError as error:
        raise BadRequest(str(error))
    if evaluator.prompt_version_tag_id is None and not keeps_following_latest:
        evaluator.prompt_version_tag = _evaluator_tag(name, prompt_version)
        shared_evaluator_changed = True
    elif evaluator.prompt_version_tag_id is not None:
        prompt_version_tag = await session.get(
            models.PromptVersionTag, evaluator.prompt_version_tag_id
        )
        if prompt_version_tag is None:
            raise NotFound("Prompt version tag was not found")
        if (
            prompt_version_tag.prompt_id != target_prompt_id
            or prompt_version_tag.prompt_version_id != prompt_version.id
        ):
            prompt_version_tag.prompt_id = target_prompt_id
            prompt_version_tag.prompt_version_id = prompt_version.id
            shared_evaluator_changed = True

    if shared_evaluator_changed:
        evaluator.user_id = user_id
        evaluator.updated_at = datetime.now(timezone.utc)


@dataclass(kw_only=True)
class LLMEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    prompt_source: Optional[UpdatePromptSource] = None
    output_configs: Optional[list[OutputConfigType]] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service


async def patch_llm_evaluator(
    context: EvaluatorServiceContext,
    evaluator_id: GlobalID,
    patch: LLMEvaluatorPatch,
) -> models.LLMEvaluator:
    """Update a shared LLM definition and its pinned prompt version atomically."""
    try:
        row_id = from_global_id_with_expected_type(evaluator_id, "LLMEvaluator")
    except ValueError as error:
        raise BadRequest(str(error)) from error
    try:
        async with context.db() as session:
            # Edits and deletes take the evaluator row first, so they queue instead of deadlocking.
            row = await session.get(models.LLMEvaluator, row_id, with_for_update=True)
            if row is None:
                raise NotFound(f"LLM evaluator not found: {evaluator_id}")
            if patch.name is not UNSET:
                try:
                    row.name = Identifier.model_validate(patch.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}") from error
            await update_llm_definition(
                session,
                row,
                prompt_source=patch.prompt_source,
                output_configs=check_output_configs(
                    "LLM",
                    row.output_configs if patch.output_configs is UNSET else patch.output_configs,
                ),
                description=patch.description,
                name=row.name,
                user_id=context.user_id,
                shared_evaluator_changed=True,
                input_schema=patch.input_schema,
            )
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        if patch.name is not UNSET and patch.name is not None:
            raise await evaluator_name_taken(context, patch.name) from error
        raise Conflict(
            "Could not update the evaluator because of a conflicting resource"
        ) from error
    return row
