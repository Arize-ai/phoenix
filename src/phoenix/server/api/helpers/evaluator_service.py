"""Shared evaluator definitions, versions, context, and validation operations."""

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional, Union, cast

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
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluator_management import (
    ensure_evaluator_prompt_label,
    raise_on_uninferable_evaluate_signature,
    release_evaluator_prompt_label,
    release_llm_evaluator_prompt,
    validate_code_evaluator_sandbox_config,
)
from phoenix.server.api.helpers.evaluator_prompt_source import (
    FromPromptVersion,
    UpdatePromptSource,
    get_prompt_version,
    pin_prompt_version,
    resolve_evaluator_prompt_version,
)
from phoenix.server.api.helpers.evaluators import (
    LLMEvaluatorOutputConfigs,
    incompatible_dataset_override_ids,
    require_categorical_output_configs,
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.prompts.validation import validate_custom_provider
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory


@dataclass(kw_only=True)
class EvaluatorServiceContext:
    db: DbSessionFactory
    sandbox_runtime: SandboxRuntimeContext
    user_id: int | None = None


def validate_output_config_names(configs: list[OutputConfigType]) -> None:
    """Reject duplicate names within one evaluator output configuration."""
    names = [config.name for config in configs]
    if len(names) != len(set(names)):
        raise BadRequest("Output config names must be unique")


def require_output_configs(configs: list[OutputConfigType]) -> None:
    """Reject an empty or name-repeating list of output configs.

    A run records its results under its output configs, so a definition needs at least one,
    and a binding that uses its evaluator's configs stores NULL rather than an empty override.
    """
    if not configs:
        raise BadRequest("At least one output config is required.")
    validate_output_config_names(configs)


@dataclass(kw_only=True)
class PatchCodeEvaluatorInput:
    id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET


@dataclass(kw_only=True)
class CreateCodeEvaluatorInput:
    name: Identifier
    source_code: str
    language: models.LanguageName
    sandbox_config_id: GlobalID
    input_mapping: InputMapping
    output_configs: list[OutputConfigType]
    description: Optional[str] = None


@dataclass(kw_only=True)
class CreateCodeEvaluatorVersionInput:
    code_evaluator_id: GlobalID
    source_code: str
    expected_current_version_id: Optional[GlobalID] = None
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET

    def changes_configuration(self) -> bool:
        return any(
            value is not UNSET
            for value in (
                self.description,
                self.sandbox_config_id,
                self.input_mapping,
                self.output_configs,
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

    if input.input_mapping is not UNSET and input.input_mapping is None:
        raise BadRequest("input_mapping cannot be set to null")
    if input.output_configs is not UNSET and input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    if input.output_configs is not UNSET:
        require_output_configs(input.output_configs)

    validated_sandbox_config_id: Optional[int] = None
    validated_source_code: Optional[str] = None
    if input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None:
        async with context.db() as session:
            code_evaluator_with_version = await code_evaluator_with_latest_version(
                session, evaluator_id
            )
            if code_evaluator_with_version is None:
                raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
            current, current_version = code_evaluator_with_version
            language = current.language
            validated_source_code = current_version.source_code if current_version else ""
        validated_sandbox_config_id = await validate_code_evaluator_sandbox_config(
            context.db,
            sandbox_config_global_id=input.sandbox_config_id,
            language=language,
            action="patching this evaluator",
            source_code=validated_source_code,
            sandbox_runtime=context.sandbox_runtime,
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
                    row.name = IdentifierModel.model_validate(input.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}")

            if input.description is not UNSET:
                row.description = input.description

            if input.sandbox_config_id is not UNSET:
                if input.sandbox_config_id is None:
                    row.sandbox_config_id = None
                else:
                    latest_source_code = (
                        current_version.source_code if current_version is not None else ""
                    )
                    if latest_source_code != validated_source_code:
                        raise Conflict(
                            "The evaluator version changed during sandbox validation; retry.",
                            reason="concurrent_change",
                        )
                    row.sandbox_config_id = validated_sandbox_config_id

            if input.input_mapping is not UNSET and input.input_mapping is not None:
                row.input_mapping = input.input_mapping

            if input.output_configs is not UNSET and input.output_configs is not None:
                row.output_configs = cast(
                    list[AnnotationConfigType],
                    input.output_configs,
                )

            # The row is returned to resolvers after the session closes, so load the
            # server-generated updated_at now instead of leaving it expired.
            await session.flush()
            await session.refresh(row, attribute_names=["updated_at"])

    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        if input.name is not UNSET and input.name is not None:
            raise await _name_taken(context, input.name) from error
        raise Conflict(
            "Could not update the evaluator because of a conflicting resource"
        ) from error

    return row


async def create_code_evaluator(
    context: EvaluatorServiceContext, input: CreateCodeEvaluatorInput
) -> models.CodeEvaluator:
    """Create a standalone code definition with its first version; nothing binds it yet."""
    try:
        validated_name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    output_configs = list(input.output_configs)
    require_output_configs(output_configs)
    raise_on_uninferable_evaluate_signature(input.source_code, input.language)
    sandbox_config_id = await validate_code_evaluator_sandbox_config(
        context.db,
        sandbox_config_global_id=input.sandbox_config_id,
        language=input.language,
        action="creating this evaluator",
        source_code=input.source_code,
        sandbox_runtime=context.sandbox_runtime,
    )
    try:
        async with context.db() as session:
            row = models.CodeEvaluator(
                name=validated_name,
                description=input.description,
                language=input.language,
                user_id=context.user_id,
                sandbox_config_id=sandbox_config_id,
                input_mapping=input.input_mapping,
                output_configs=cast(list[AnnotationConfigType], output_configs),
            )
            session.add(row)
            await session.flush()
            session.add(
                models.CodeEvaluatorVersion(
                    code_evaluator_id=row.id,
                    source_code=input.source_code,
                    user_id=context.user_id,
                )
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await _name_taken(context, input.name) from error
    return row


_TYPENAME_BY_KIND = {"LLM": "LLMEvaluator", "CODE": "CodeEvaluator", "BUILTIN": "BuiltInEvaluator"}


async def _name_taken(context: EvaluatorServiceContext, name: Union[str, Identifier]) -> Conflict:
    """The error for a create whose name another evaluator already holds."""
    name = name.root if isinstance(name, Identifier) else name
    async with context.db() as session:
        existing = (
            await session.execute(
                select(models.Evaluator.id, models.Evaluator.kind).where(
                    models.Evaluator.name == IdentifierModel.model_validate(name)
                )
            )
        ).one_or_none()
    if existing is None:
        return Conflict(f"Could not create evaluator '{name}' because of a conflicting resource")
    row_id, kind = existing
    return AlreadyExists(
        f"An evaluator named '{name}' already exists",
        existing_id=str(GlobalID(_TYPENAME_BY_KIND[kind], str(row_id))),
    )


@dataclass(kw_only=True)
class CreateLLMEvaluatorInput:
    name: Identifier
    prompt_version_id: GlobalID
    output_configs: list[OutputConfigType]
    description: Optional[str] = None


async def create_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateLLMEvaluatorInput
) -> models.LLMEvaluator:
    """Create a standalone LLM definition that runs an existing prompt version, pinned by
    a tag the evaluator owns; nothing binds it yet."""
    try:
        name = IdentifierModel.model_validate(input.name)
        require_categorical_output_configs(input.output_configs)
        output_configs = list(
            LLMEvaluatorOutputConfigs.model_validate({"configs": input.output_configs}).configs
        )
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
    try:
        async with context.db() as session:
            version = await get_prompt_version(session, input.prompt_version_id)
            evaluator = models.LLMEvaluator(
                name=name,
                description=input.description,
                kind="LLM",
                output_configs=output_configs,
                user_id=context.user_id,
                prompt_id=version.prompt_id,
            )
            try:
                validate_consistent_llm_evaluator_and_prompt_version(version, evaluator)
            except ValueError as error:
                raise BadRequest(str(error))
            session.add(evaluator)
            await session.flush()
            await ensure_evaluator_prompt_label(session, version.prompt_id)
            evaluator.prompt_version_tag = models.PromptVersionTag(
                name=IdentifierModel.model_validate(f"{name.root}-evaluator-{token_hex(4)}"),
                prompt_id=version.prompt_id,
                prompt_version_id=version.id,
            )
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await _name_taken(context, input.name) from error
    return evaluator


async def delete_llm_evaluator(context: EvaluatorServiceContext, evaluator_id: GlobalID) -> None:
    """Delete an LLM definition nothing binds, with the tag that pins its version; the
    prompt is kept. A bound definition is refused with Conflict."""
    try:
        row_id = from_global_id_with_expected_type(evaluator_id, "LLMEvaluator")
    except ValueError as error:
        raise BadRequest(str(error)) from error
    async with context.db() as session:
        row = await session.get(models.LLMEvaluator, row_id, with_for_update=True)
        if row is None:
            return
        await _refuse_bound_evaluator(session, row_id, evaluator_id)
        prompt_id, tag_id = row.prompt_id, row.prompt_version_tag_id
        await session.delete(row)
        await session.flush()
        await release_llm_evaluator_prompt(
            session, prompt_version_tag_id=tag_id, prompt_id=prompt_id
        )


async def _refuse_bound_evaluator(
    session: AsyncSession, row_id: int, evaluator_id: GlobalID
) -> None:
    project_bindings = await session.scalar(
        select(func.count(models.ProjectEvaluator.id)).where(
            models.ProjectEvaluator.evaluator_id == row_id
        )
    )
    dataset_bindings = await session.scalar(
        select(func.count(models.DatasetEvaluators.id)).where(
            models.DatasetEvaluators.evaluator_id == row_id
        )
    )
    if project_bindings or dataset_bindings:
        raise Conflict(
            f"Evaluator {evaluator_id} is still bound by {project_bindings} project and "
            f"{dataset_bindings} dataset bindings; delete those bindings first",
            reason="still_bound",
            binding_counts={"project": project_bindings, "dataset": dataset_bindings},
        )


async def delete_code_evaluator(context: EvaluatorServiceContext, evaluator_id: GlobalID) -> None:
    """Delete a code definition nothing binds; a bound definition is refused with Conflict."""
    try:
        row_id = from_global_id_with_expected_type(evaluator_id, "CodeEvaluator")
    except ValueError as error:
        raise BadRequest(str(error)) from error
    async with context.db() as session:
        row = await session.get(models.CodeEvaluator, row_id, with_for_update=True)
        if row is None:
            return
        await _refuse_bound_evaluator(session, row_id, evaluator_id)
        await session.delete(row)


def _version_id_or_none(version: Optional[models.CodeEvaluatorVersion]) -> Optional[int]:
    return version.id if version is not None else None


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
    actual = _version_id_or_none(current_version)
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
    if input.input_mapping is not UNSET and input.input_mapping is None:
        raise BadRequest("input_mapping cannot be set to null")
    if input.output_configs is not UNSET and input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    if input.output_configs is not UNSET:
        require_output_configs(input.output_configs)

    user_id = context.user_id
    candidate = models.CodeEvaluatorVersion(
        code_evaluator_id=evaluator_id,
        source_code=input.source_code,
        user_id=user_id,
    )
    async with context.db() as session:
        code_evaluator_with_version = await code_evaluator_with_latest_version(
            session, evaluator_id
        )
        if code_evaluator_with_version is None:
            raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
        current, current_version = code_evaluator_with_version
        _check_expected_version(input, current_version)
        validated_language = current.language
        source_unchanged = current_version is not None and current_version.has_identical_content(
            candidate
        )
        if source_unchanged and not input.changes_configuration():
            assert current_version is not None
            return current, current_version, False
        validated_current_version_id = _version_id_or_none(current_version)
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

    raise_on_uninferable_evaluate_signature(input.source_code, validated_language)
    if target_sandbox_config_id is not None:
        await validate_code_evaluator_sandbox_config(
            context.db,
            sandbox_config_global_id=GlobalID("SandboxConfig", str(target_sandbox_config_id)),
            language=validated_language,
            action="creating this evaluator version",
            source_code=input.source_code,
            sandbox_runtime=context.sandbox_runtime,
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
            if row.language != validated_language:
                raise Conflict(
                    "The evaluator language changed during source validation; retry.",
                    reason="concurrent_change",
                )
            if _version_id_or_none(current_version) != validated_current_version_id:
                if current_version is None or not current_version.has_identical_content(candidate):
                    raise Conflict(
                        "The evaluator version changed during source validation; retry.",
                        reason="concurrent_change",
                    )
            if input.description is not UNSET:
                row.description = input.description
            if input.sandbox_config_id is not UNSET:
                row.sandbox_config_id = target_sandbox_config_id
            elif row.sandbox_config_id != target_sandbox_config_id:
                raise Conflict(
                    "The evaluator sandbox changed during source validation; retry.",
                    reason="concurrent_change",
                )
            if input.input_mapping is not UNSET and input.input_mapping is not None:
                row.input_mapping = input.input_mapping
            if input.output_configs is not UNSET and input.output_configs is not None:
                row.output_configs = cast(list[AnnotationConfigType], input.output_configs)
            was_created = current_version is None or not current_version.has_identical_content(
                candidate
            )
            if was_created:
                candidate.code_evaluator_id = row.id
                session.add(candidate)
            await session.flush()
            version = candidate if was_created else current_version
            assert version is not None
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        raise Conflict(
            "Could not create the code evaluator version because of a conflicting resource"
        ) from e

    return row, version, was_created


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
) -> models.PromptVersion:
    """Apply a definition edit and return the prompt version the evaluator now runs.
    Without a prompt source the evaluator keeps running what it runs: its pinned version,
    or, for an evaluator without a pin, its prompt's newest version, which stays unpinned."""
    base: Optional[models.PromptVersion] = None
    keeps_following_latest = prompt_source is None and evaluator.prompt_version_tag_id is None
    if isinstance(prompt_source, FromPromptVersion):
        base = await get_prompt_version(session, prompt_source.prompt_version_id)
    elif evaluator.prompt_version_tag_id is not None or keeps_following_latest:
        base = await resolve_evaluator_prompt_version(session, evaluator)

    target_prompt_id = base.prompt_id if base is not None else evaluator.prompt_id
    content = prompt_source.content if prompt_source is not None else None
    if content is not None:
        await validate_custom_provider(session, content)
    prompt_version = await pin_prompt_version(
        session, base=base, content=content, prompt_id=target_prompt_id
    )
    if prompt_version is not base:
        shared_evaluator_changed = True
    final_prompt_version_id = prompt_version.id

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
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)
    except ValueError as error:
        raise BadRequest(str(error))
    if evaluator.prompt_version_tag_id is None and not keeps_following_latest:
        evaluator.prompt_version_tag = models.PromptVersionTag(
            name=IdentifierModel.model_validate(f"{name}-evaluator-{token_hex(4)}"),
            prompt_id=target_prompt_id,
            prompt_version_id=final_prompt_version_id,
        )
        shared_evaluator_changed = True
    elif evaluator.prompt_version_tag_id is not None:
        prompt_version_tag = await session.get(
            models.PromptVersionTag, evaluator.prompt_version_tag_id
        )
        if prompt_version_tag is None:
            raise NotFound("Prompt version tag was not found")
        if (
            prompt_version_tag.prompt_id != target_prompt_id
            or prompt_version_tag.prompt_version_id != final_prompt_version_id
        ):
            prompt_version_tag.prompt_id = target_prompt_id
            prompt_version_tag.prompt_version_id = final_prompt_version_id
            shared_evaluator_changed = True

    if shared_evaluator_changed:
        evaluator.user_id = user_id
        evaluator.updated_at = datetime.now(timezone.utc)
    return prompt_version


@dataclass(kw_only=True)
class LLMEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    prompt_source: Optional[UpdatePromptSource] = None
    output_configs: Optional[list[OutputConfigType]] = UNSET


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
            # Tag moves and evaluator edits lock the evaluator row first, so each validates
            # against the other's committed state.
            row = await session.get(models.LLMEvaluator, row_id, with_for_update=True)
            if row is None:
                raise NotFound(f"LLM evaluator not found: {evaluator_id}")
            if patch.name is not UNSET:
                try:
                    row.name = IdentifierModel.model_validate(patch.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}") from error
            configs = row.output_configs if patch.output_configs is UNSET else patch.output_configs
            try:
                output_configs = LLMEvaluatorOutputConfigs.model_validate(
                    {"configs": configs}
                ).configs
            except ValidationError as error:
                raise BadRequest(str(error)) from error
            if patch.prompt_source is not None and patch.prompt_source.content is not None:
                patch.prompt_source.content.user_id = context.user_id
            prompt_version = await update_llm_definition(
                session,
                row,
                prompt_source=patch.prompt_source,
                output_configs=output_configs,
                description=patch.description,
                name=row.name,
                user_id=context.user_id,
                shared_evaluator_changed=True,
            )
            await _reject_incompatible_dataset_overrides(session, row, prompt_version)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        if patch.name is not UNSET and patch.name is not None:
            raise await _name_taken(context, patch.name) from error
        raise Conflict(
            "Could not update the evaluator because of a conflicting resource"
        ) from error
    return row


async def _reject_incompatible_dataset_overrides(
    session: AsyncSession,
    evaluator: models.LLMEvaluator,
    prompt_version: models.PromptVersion,
) -> None:
    """Every dataset binding override must stay valid against the prompt the evaluator runs."""
    if incompatible := await incompatible_dataset_override_ids(session, evaluator, prompt_version):
        raise Conflict(
            "Dataset evaluator bindings override outputs that the updated prompt no longer "
            f"supports: {', '.join(incompatible)}",
            reason="incompatible_override",
            dataset_evaluator_ids=incompatible,
        )
