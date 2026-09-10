"""Evaluator operations shared by the GraphQL and REST APIs."""

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional, cast

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import (
    code_evaluator_with_latest_version,
)
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    CategoricalOutputConfig,
    OutputConfigType,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluator_management import (
    _ensure_evaluator_prompt_label,
    _garbage_collect_evaluators,
    _generate_unique_evaluator_name,
    _get_trace_project_for_project_evaluator,
    _materialize_project_evaluator_evaluation_delay,
    _parse_evaluator_id,
    _raise_on_uninferable_evaluate_signature,
    _validate_code_evaluator_sandbox_config,
    _validate_project_evaluator_filter,
    _validate_project_evaluator_project,
    _validate_project_evaluator_sampling_rate,
    _validate_project_evaluator_target_update,
)
from phoenix.server.api.helpers.evaluators import (
    LLMEvaluatorOutputConfigs,
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.types.Evaluator import (
    CodeEvaluator,
    EvaluationTarget,
    ProjectEvaluator,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.SandboxConfig import (
    Language,
    SandboxConfig,
)
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


@dataclass(kw_only=True)
class CreateProjectLLMEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    prompt_version: models.PromptVersion
    output_configs: list[OutputConfigType]
    input_mapping: InputMapping
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    prompt_version_id: Optional[GlobalID] = UNSET
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class UpdateProjectLLMEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    prompt_version: models.PromptVersion
    output_configs: list[OutputConfigType]
    input_mapping: InputMapping
    sampling_rate: float
    evaluation_target: EvaluationTarget
    filter_condition: str
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    evaluation_delay_seconds: Optional[int] = UNSET


@dataclass(kw_only=True)
class AddProjectCodeEvaluatorInput:
    project_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget
    input_mapping: Optional[InputMapping] = None
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class CreateProjectCodeEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    source_code: str
    language: Language
    sandbox_config_id: GlobalID
    evaluator_input_mapping: InputMapping
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    output_configs: Optional[list[OutputConfigType]] = None
    input_mapping: Optional[InputMapping] = None
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class UpdateProjectCodeEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget
    filter_condition: str
    evaluator_input_mapping: Optional[InputMapping] = UNSET
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    source_code: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    evaluation_delay_seconds: Optional[int] = UNSET


@dataclass(kw_only=True)
class SetProjectEvaluatorEnabledInput:
    project_evaluator_id: GlobalID
    enabled: bool


@dataclass(kw_only=True)
class DeleteProjectEvaluatorsInput:
    project_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


@dataclass(kw_only=True)
class PatchCodeEvaluatorInput:
    id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET


@dataclass(kw_only=True)
class CreateCodeEvaluatorVersionInput:
    code_evaluator_id: GlobalID
    source_code: str


async def create_project_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateProjectLLMEvaluatorInput
) -> models.ProjectEvaluator:
    """Create an LLM definition, pinned prompt version, and project binding atomically."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
    except ValueError:
        raise BadRequest(f"Invalid project id: {input.project_id}")
    _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    _validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )
    try:
        name = IdentifierModel.model_validate(input.name)
        prompt_version = input.prompt_version
        output_configs = list(
            LLMEvaluatorOutputConfigs.model_validate({"configs": input.output_configs}).configs
        )
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))

    user_id = context.user_id
    prompt_version.user_id = user_id

    try:
        async with context.db() as session:
            project = await _validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator_name = await _generate_unique_evaluator_name(session, name)

            target_prompt_version_id: Optional[int] = None
            if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                prompt_version_id = from_global_id_with_expected_type(
                    input.prompt_version_id, PromptVersion.__name__
                )
                existing_prompt_version = await session.get(models.PromptVersion, prompt_version_id)
                if existing_prompt_version is None:
                    raise NotFound(f"Prompt version not found: {input.prompt_version_id}")
                prompt = await session.get(models.Prompt, existing_prompt_version.prompt_id)
                if prompt is None:
                    raise NotFound("Prompt for the selected version was not found")
                if existing_prompt_version.has_identical_content(prompt_version):
                    target_prompt_version_id = existing_prompt_version.id
                else:
                    prompt_version.prompt_id = prompt.id
                    session.add(prompt_version)
                    await session.flush()
                    target_prompt_version_id = prompt_version.id
            else:
                prompt = models.Prompt(
                    name=IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}"),
                    description=input.description,
                    prompt_versions=[prompt_version],
                )

            evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description=input.description,
                kind="LLM",
                output_configs=output_configs,
                user_id=user_id,
                prompt=prompt,
            )
            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)
            except ValueError as error:
                raise BadRequest(str(error))
            session.add(evaluator)
            await session.flush()
            await _ensure_evaluator_prompt_label(session, prompt.id)
            evaluator.prompt_version_tag = models.PromptVersionTag(
                name=IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}"),
                prompt_id=prompt.id,
                prompt_version_id=target_prompt_version_id or prompt_version.id,
            )
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator.id,
                trace_project=_get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target.value,
                input_mapping=input.input_mapping,
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict("A project evaluator with this name already exists for this project")

    return project_evaluator


async def update_project_llm_evaluator(
    context: EvaluatorServiceContext, input: UpdateProjectLLMEvaluatorInput
) -> models.ProjectEvaluator:
    """Update an LLM binding and shared definition in one transaction."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, ProjectEvaluator.__name__
        )
    except ValueError:
        raise BadRequest(f"Invalid project evaluator id: {input.project_evaluator_id}")
    _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    _validate_project_evaluator_sampling_rate(input.sampling_rate)
    if input.enabled is None:
        raise BadRequest("enabled cannot be set to null")
    if input.evaluation_delay_seconds is not UNSET:
        _materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
    try:
        name = IdentifierModel.model_validate(input.name)
        prompt_version = input.prompt_version
        output_configs = list(
            LLMEvaluatorOutputConfigs.model_validate({"configs": input.output_configs}).configs
        )
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))

    user_id = context.user_id
    prompt_version.user_id = user_id

    try:
        async with context.db() as session:
            pair = (
                await session.execute(
                    select(models.ProjectEvaluator, models.LLMEvaluator)
                    .join(
                        models.LLMEvaluator,
                        models.ProjectEvaluator.evaluator_id == models.LLMEvaluator.id,
                    )
                    .where(models.ProjectEvaluator.id == project_evaluator_id)
                )
            ).one_or_none()
            if pair is None:
                raise NotFound(f"LLM project evaluator not found: {input.project_evaluator_id}")
            project_evaluator, evaluator = pair
            _validate_project_evaluator_target_update(
                project_evaluator,
                input.evaluation_target,
            )
            shared_evaluator_changed = False
            if project_evaluator.name != name:
                evaluator.name = await _generate_unique_evaluator_name(session, name)
                shared_evaluator_changed = True

            await _update_llm_definition(
                session,
                evaluator,
                prompt_version=prompt_version,
                output_configs=output_configs,
                description=input.description,
                prompt_version_id=input.prompt_version_id,
                name=name,
                user_id=user_id,
                shared_evaluator_changed=shared_evaluator_changed,
            )

            project_evaluator.name = name
            project_evaluator.filter_condition = input.filter_condition
            project_evaluator.sampling_rate = input.sampling_rate
            project_evaluator.evaluation_target = input.evaluation_target.value
            project_evaluator.input_mapping = input.input_mapping
            if input.evaluation_delay_seconds is not UNSET:
                project_evaluator.evaluation_delay_seconds = (
                    _materialize_project_evaluator_evaluation_delay(
                        input.evaluation_delay_seconds, input.evaluation_target
                    )
                )
            if input.enabled is not UNSET:
                assert input.enabled is not None
                project_evaluator.enabled = input.enabled
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict("A project evaluator with this name already exists for this project")

    return cast(models.ProjectEvaluator, project_evaluator)


async def add_project_code_evaluator(
    context: EvaluatorServiceContext, input: AddProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Bind an existing code evaluator to a project without copying its definition."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
    except ValueError:
        raise BadRequest(f"Invalid project id: {input.project_id}")
    try:
        evaluator_id, evaluator_kind = _parse_evaluator_id(input.evaluator_id)
    except ValueError as error:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {error}")
    if evaluator_kind != "CODE":
        raise BadRequest("Evaluator must be a CODE evaluator")
    try:
        name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(str(error))
    _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    _validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )

    try:
        async with context.db() as session:
            project = await _validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            if await session.get(models.CodeEvaluator, evaluator_id) is None:
                raise BadRequest("CODE evaluator not found")
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator_id,
                trace_project=_get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target.value,
                input_mapping=(input.input_mapping if input.input_mapping is not None else None),
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict("A project evaluator with this name already exists for this project")

    return project_evaluator


async def create_project_code_evaluator(
    context: EvaluatorServiceContext, input: CreateProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Validate code and create its definition, initial version, and project binding."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
        name = IdentifierModel.model_validate(input.name)
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
    _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    _validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )
    _raise_on_uninferable_evaluate_signature(input.source_code, input.language)
    if input.output_configs is not None:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as error:
            raise BadRequest(str(error))
    output_configs = cast(
        list[AnnotationConfigType],
        (input.output_configs or []),
    )

    user_id = context.user_id

    # Validated before the write session opens: the helper takes the session
    # factory and opens its own session, which would otherwise nest inside
    # the transaction below.
    sandbox_config_id = await _validate_code_evaluator_sandbox_config(
        context.db,
        sandbox_config_global_id=input.sandbox_config_id,
        language=input.language.value,
        action="creating this evaluator",
        source_code=input.source_code,
        sandbox_runtime=context.sandbox_runtime,
    )

    try:
        async with context.db() as session:
            project = await _validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator_name = await _generate_unique_evaluator_name(session, name)
            evaluator = models.CodeEvaluator(
                name=evaluator_name,
                description=input.description,
                language=input.language.value,
                user_id=user_id,
                sandbox_config_id=sandbox_config_id,
                input_mapping=input.evaluator_input_mapping,
                output_configs=output_configs,
            )
            session.add(evaluator)
            await session.flush()
            session.add(
                models.CodeEvaluatorVersion(
                    code_evaluator_id=evaluator.id,
                    source_code=input.source_code,
                    user_id=user_id,
                )
            )
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator.id,
                trace_project=_get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target.value,
                input_mapping=(input.input_mapping if input.input_mapping is not None else None),
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict("A project evaluator with this name already exists for this project")

    return project_evaluator


async def update_project_code_evaluator(
    context: EvaluatorServiceContext, input: UpdateProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Update a code binding and its shared definition using the GraphQL edit contract."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, ProjectEvaluator.__name__
        )
        name = IdentifierModel.model_validate(input.name)
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
    _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    _validate_project_evaluator_sampling_rate(input.sampling_rate)
    if input.evaluator_input_mapping is None:
        raise BadRequest("evaluator_input_mapping cannot be set to null")
    if input.enabled is None:
        raise BadRequest("enabled cannot be set to null")
    if input.evaluation_delay_seconds is not UNSET:
        _materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
    if input.source_code is not UNSET and input.source_code is None:
        raise BadRequest("source_code cannot be set to null")
    if input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    if input.output_configs is not UNSET:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as error:
            raise BadRequest(str(error))

    user_id = context.user_id

    # Validated before the write session opens: the helper takes the session
    # factory and opens its own session, which would otherwise nest inside
    # the transaction below.
    validated_sandbox_config_id: Optional[int] = None
    if input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None:
        async with context.db() as session:
            current_pair = (
                await session.execute(
                    select(models.ProjectEvaluator, models.CodeEvaluator)
                    .join(
                        models.CodeEvaluator,
                        models.ProjectEvaluator.evaluator_id == models.CodeEvaluator.id,
                    )
                    .where(models.ProjectEvaluator.id == project_evaluator_id)
                )
            ).one_or_none()
            if current_pair is None:
                raise NotFound(f"CODE project evaluator not found: {input.project_evaluator_id}")
            _, current_evaluator = current_pair
            current_language = current_evaluator.language
            current_with_version = await code_evaluator_with_latest_version(
                session, current_evaluator.id
            )
            stored_source_code = (
                current_with_version[1].source_code
                if current_with_version is not None and current_with_version[1] is not None
                else ""
            )
        # Source code supplied in this same request is what will be stored,
        # so the sandbox is validated against that rather than the version
        # it is about to replace.
        validated_sandbox_config_id = await _validate_code_evaluator_sandbox_config(
            context.db,
            sandbox_config_global_id=input.sandbox_config_id,
            language=current_language,
            action="updating this evaluator",
            source_code=(
                input.source_code
                if input.source_code is not UNSET and input.source_code is not None
                else stored_source_code
            ),
            sandbox_runtime=context.sandbox_runtime,
        )

    try:
        async with context.db() as session:
            pair = (
                await session.execute(
                    select(models.ProjectEvaluator, models.CodeEvaluator)
                    .join(
                        models.CodeEvaluator,
                        models.ProjectEvaluator.evaluator_id == models.CodeEvaluator.id,
                    )
                    .where(models.ProjectEvaluator.id == project_evaluator_id)
                )
            ).one_or_none()
            if pair is None:
                raise NotFound(f"CODE project evaluator not found: {input.project_evaluator_id}")
            project_evaluator, evaluator = pair
            _validate_project_evaluator_target_update(
                project_evaluator,
                input.evaluation_target,
            )
            shared_evaluator_changed = False
            if project_evaluator.name != name:
                evaluator.name = await _generate_unique_evaluator_name(session, name)
                shared_evaluator_changed = True
            if input.description is not UNSET and evaluator.description != input.description:
                evaluator.description = input.description
                shared_evaluator_changed = True
            if input.evaluator_input_mapping is not UNSET:
                assert input.evaluator_input_mapping is not None
                evaluator_input_mapping = input.evaluator_input_mapping
                if evaluator.input_mapping != evaluator_input_mapping:
                    evaluator.input_mapping = evaluator_input_mapping
                    shared_evaluator_changed = True

            if input.sandbox_config_id is not UNSET:
                if input.sandbox_config_id is None:
                    sandbox_config_id = None
                else:
                    sandbox_config_id = validated_sandbox_config_id
                if evaluator.sandbox_config_id != sandbox_config_id:
                    evaluator.sandbox_config_id = sandbox_config_id
                    shared_evaluator_changed = True
            if input.output_configs is not UNSET:
                output_configs = cast(
                    list[AnnotationConfigType],
                    input.output_configs,
                )
                if evaluator.output_configs != output_configs:
                    evaluator.output_configs = output_configs
                    shared_evaluator_changed = True
            if input.source_code is not UNSET and input.source_code is not None:
                _raise_on_uninferable_evaluate_signature(
                    input.source_code, Language(evaluator.language)
                )
                locked = await code_evaluator_with_latest_version(session, evaluator.id)
                if locked is None:
                    raise NotFound(
                        f"CODE project evaluator not found: {input.project_evaluator_id}"
                    )
                _, current_version = locked
                candidate = models.CodeEvaluatorVersion(
                    code_evaluator_id=evaluator.id,
                    source_code=input.source_code,
                    user_id=user_id,
                )
                if current_version is None or not current_version.has_identical_content(candidate):
                    session.add(candidate)
                    shared_evaluator_changed = True

            if shared_evaluator_changed:
                evaluator.user_id = user_id

            project_evaluator.name = name
            project_evaluator.filter_condition = input.filter_condition
            project_evaluator.sampling_rate = input.sampling_rate
            project_evaluator.evaluation_target = input.evaluation_target.value
            if input.input_mapping is not UNSET:
                project_evaluator.input_mapping = (
                    input.input_mapping if input.input_mapping is not None else None
                )
            if input.evaluation_delay_seconds is not UNSET:
                project_evaluator.evaluation_delay_seconds = (
                    _materialize_project_evaluator_evaluation_delay(
                        input.evaluation_delay_seconds, input.evaluation_target
                    )
                )
            if input.enabled is not UNSET:
                assert input.enabled is not None
                project_evaluator.enabled = input.enabled
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict("A project evaluator with this name already exists for this project")

    return cast(models.ProjectEvaluator, project_evaluator)


async def set_project_evaluator_enabled(
    context: EvaluatorServiceContext, input: SetProjectEvaluatorEnabledInput
) -> models.ProjectEvaluator:
    """Enable or disable a binding without changing its other settings."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, ProjectEvaluator.__name__
        )
    except ValueError as error:
        raise BadRequest(str(error))
    async with context.db() as session:
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        if project_evaluator is None:
            raise NotFound(f"Project evaluator not found: {input.project_evaluator_id}")
        project_evaluator.enabled = input.enabled
        await session.flush()
    return project_evaluator


async def delete_project_evaluators(
    context: EvaluatorServiceContext, input: DeleteProjectEvaluatorsInput
) -> list[GlobalID]:
    """Delete bindings and their trace projects, collecting unreferenced definitions."""
    project_evaluator_ids: list[int] = []
    for global_id in input.project_evaluator_ids:
        try:
            project_evaluator_ids.append(
                from_global_id_with_expected_type(global_id, ProjectEvaluator.__name__)
            )
        except ValueError:
            raise BadRequest(f"Invalid project evaluator id: {global_id}")
    if not project_evaluator_ids:
        return []

    deleted_ids: list[GlobalID] = []
    async with context.db() as session:
        llm_evaluator_alias = aliased(models.LLMEvaluator, flat=True)
        rows = (
            await session.execute(
                select(
                    models.ProjectEvaluator.id,
                    models.ProjectEvaluator.evaluator_id,
                    models.ProjectEvaluator.trace_project_id,
                    models.Evaluator.kind,
                    llm_evaluator_alias.prompt_id,
                )
                .join(
                    models.Evaluator,
                    models.ProjectEvaluator.evaluator_id == models.Evaluator.id,
                )
                .outerjoin(
                    llm_evaluator_alias,
                    models.ProjectEvaluator.evaluator_id == llm_evaluator_alias.id,
                )
                .where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
            )
        ).all()
        evaluator_ids: set[int] = set()
        prompt_ids: set[int] = set()
        trace_project_ids: list[int] = []
        actual_project_evaluator_ids: list[int] = []
        for project_evaluator_id, evaluator_id, trace_project_id, kind, prompt_id in rows:
            actual_project_evaluator_ids.append(project_evaluator_id)
            trace_project_ids.append(trace_project_id)
            deleted_ids.append(GlobalID(ProjectEvaluator.__name__, str(project_evaluator_id)))
            if kind != "BUILTIN":
                evaluator_ids.add(evaluator_id)
                if prompt_id is not None:
                    prompt_ids.add(prompt_id)
        if actual_project_evaluator_ids:
            await session.execute(
                delete(models.ProjectEvaluator).where(
                    models.ProjectEvaluator.id.in_(actual_project_evaluator_ids)
                )
            )
            await session.execute(
                delete(models.Project).where(models.Project.id.in_(trace_project_ids))
            )
            await _garbage_collect_evaluators(
                session,
                evaluator_ids=evaluator_ids,
                prompt_ids=prompt_ids,
                delete_associated_prompt=input.delete_associated_prompt,
            )

    return deleted_ids


async def patch_code_evaluator(
    context: EvaluatorServiceContext, input: PatchCodeEvaluatorInput
) -> models.CodeEvaluator:
    """Patch a shared code definition while preserving its immutable source versions."""
    evaluator_id = from_global_id_with_expected_type(
        global_id=input.id, expected_type_name=CodeEvaluator.__name__
    )

    if input.input_mapping is not UNSET and input.input_mapping is None:
        raise BadRequest("input_mapping cannot be set to null")
    if input.output_configs is not UNSET and input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")

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
        validated_sandbox_config_id = await _validate_code_evaluator_sandbox_config(
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
                            "The evaluator version changed during sandbox validation; retry."
                        )
                    row.sandbox_config_id = validated_sandbox_config_id

            if input.input_mapping is not UNSET and input.input_mapping is not None:
                row.input_mapping = input.input_mapping

            if input.output_configs is not UNSET and input.output_configs is not None:
                try:
                    validate_output_config_names(input.output_configs)
                except ValueError as e:
                    raise BadRequest(str(e))
                row.output_configs = cast(
                    list[AnnotationConfigType],
                    input.output_configs,
                )

    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise Conflict(
            "Could not update the evaluator because of a conflicting resource"
        ) from error

    return row


async def create_code_evaluator_version(
    context: EvaluatorServiceContext, input: CreateCodeEvaluatorVersionInput
) -> tuple[models.CodeEvaluator, models.CodeEvaluatorVersion, bool]:
    """Return the evaluator, exact persisted version, and whether a version was appended."""
    evaluator_id = from_global_id_with_expected_type(
        global_id=input.code_evaluator_id, expected_type_name=CodeEvaluator.__name__
    )

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
        validated_language = current.language
        validated_sandbox_config_id = current.sandbox_config_id
        if current_version is not None and current_version.has_identical_content(candidate):
            return current, current_version, False
        validated_current_version_id = current_version.id if current_version is not None else None

    _raise_on_uninferable_evaluate_signature(input.source_code, Language(validated_language))
    if validated_sandbox_config_id is not None:
        await _validate_code_evaluator_sandbox_config(
            context.db,
            sandbox_config_global_id=GlobalID(
                SandboxConfig.__name__, str(validated_sandbox_config_id)
            ),
            language=validated_language,
            action="creating this evaluator version",
            source_code=input.source_code,
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
            if (
                row.language != validated_language
                or row.sandbox_config_id != validated_sandbox_config_id
            ):
                raise Conflict("The evaluator sandbox changed during source validation; retry.")
            current_version_id = current_version.id if current_version is not None else None
            if current_version_id != validated_current_version_id:
                if current_version is None or not current_version.has_identical_content(candidate):
                    raise Conflict("The evaluator version changed during source validation; retry.")
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
        raise BadRequest(f"Could not create code evaluator version: {e}")

    return row, version, was_created


async def _update_llm_definition(
    session: AsyncSession,
    evaluator: models.LLMEvaluator,
    *,
    prompt_version: models.PromptVersion,
    output_configs: list[CategoricalOutputConfig],
    description: Optional[str],
    prompt_version_id: Optional[GlobalID],
    name: Identifier,
    user_id: int | None,
    shared_evaluator_changed: bool = False,
) -> None:
    selected_version: Optional[models.PromptVersion] = None
    if prompt_version_id is not UNSET and prompt_version_id is not None:
        selected_version_id = from_global_id_with_expected_type(
            prompt_version_id, PromptVersion.__name__
        )
        selected_version = await session.get(models.PromptVersion, selected_version_id)
        if selected_version is None:
            raise NotFound(f"Prompt version not found: {prompt_version_id}")
    elif evaluator.prompt_version_tag_id is not None:
        selected_version = await session.scalar(
            select(models.PromptVersion)
            .join(
                models.PromptVersionTag,
                models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
            )
            .where(models.PromptVersionTag.id == evaluator.prompt_version_tag_id)
        )

    target_prompt_id = (
        selected_version.prompt_id if selected_version is not None else evaluator.prompt_id
    )
    final_prompt_version_id: Optional[int] = None
    if selected_version is not None and selected_version.has_identical_content(prompt_version):
        final_prompt_version_id = selected_version.id
    else:
        prompt_version.prompt_id = target_prompt_id
        session.add(prompt_version)
        await session.flush()
        final_prompt_version_id = prompt_version.id
        shared_evaluator_changed = True

    if description is not UNSET and evaluator.description != description:
        evaluator.description = description
        shared_evaluator_changed = True
    if evaluator.output_configs != output_configs:
        evaluator.output_configs = output_configs
        shared_evaluator_changed = True
    if evaluator.prompt_id != target_prompt_id:
        evaluator.prompt_id = target_prompt_id
        shared_evaluator_changed = True
    try:
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)
    except ValueError as error:
        raise BadRequest(str(error))
    if evaluator.prompt_version_tag_id is None:
        evaluator.prompt_version_tag = models.PromptVersionTag(
            name=IdentifierModel.model_validate(f"{name}-evaluator-{token_hex(4)}"),
            prompt_id=target_prompt_id,
            prompt_version_id=final_prompt_version_id,
        )
        shared_evaluator_changed = True
    else:
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
