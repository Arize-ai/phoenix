"""Operations for binding evaluator definitions to projects."""

from dataclasses import dataclass
from secrets import token_hex
from typing import Any, Optional, cast

from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import (
    code_evaluator_with_latest_version,
    delete_projects_and_evaluator_trace_projects,
)
from phoenix.db.types.annotation_configs import AnnotationConfigType, OutputConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluator_management import (
    ensure_evaluator_prompt_label,
    garbage_collect_evaluators,
    generate_unique_evaluator_name,
    get_trace_project_for_project_evaluator,
    is_sole_evaluator_binding,
    materialize_project_evaluator_evaluation_delay,
    parse_evaluator_id,
    raise_on_uninferable_evaluate_signature,
    validate_code_evaluator_sandbox_config,
    validate_project_evaluator_filter,
    validate_project_evaluator_project,
    validate_project_evaluator_sampling_rate,
    validate_project_evaluator_target_update,
)
from phoenix.server.api.helpers.evaluator_prompt_source import (
    CreatePromptSource,
    FromPromptVersion,
    UpdatePromptSource,
    get_prompt_version,
    pin_prompt_version,
    resolve_evaluator_prompt_version,
)
from phoenix.server.api.helpers.evaluator_service import (
    EvaluatorServiceContext,
    reject_incompatible_dataset_overrides,
    require_output_configs,
    update_llm_definition,
)
from phoenix.server.api.helpers.evaluators import (
    LLMEvaluatorOutputConfigs,
    require_categorical_output_configs,
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.prompts.validation import validate_custom_provider
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.online_eval.db_coordinator import (
    count_cleared_work,
    drop_all_queued_work,
    drop_queued_work,
)


@dataclass(kw_only=True)
class CreateProjectLLMEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    prompt_source: CreatePromptSource
    output_configs: list[OutputConfigType]
    input_mapping: Optional[InputMapping]
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
    description: Optional[str] = None
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class UpdateProjectLLMEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    prompt_source: UpdatePromptSource
    output_configs: list[OutputConfigType]
    input_mapping: InputMapping
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
    filter_condition: str
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    evaluation_delay_seconds: Optional[int] = UNSET


@dataclass(kw_only=True)
class AddProjectCodeEvaluatorInput:
    project_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
    input_mapping: Optional[InputMapping] = None
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class CreateProjectCodeEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    source_code: str
    language: models.LanguageName
    sandbox_config_id: GlobalID
    evaluator_input_mapping: InputMapping
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
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
    evaluation_target: models.EvaluationTarget
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
    delete_associated_prompt: bool = False


async def create_project_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateProjectLLMEvaluatorInput
) -> models.ProjectEvaluator:
    """Create an LLM definition, pinned prompt version, and project binding atomically."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project id: {input.project_id}")
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )
    try:
        name = IdentifierModel.model_validate(input.name)
        require_categorical_output_configs(input.output_configs)
        output_configs = list(
            LLMEvaluatorOutputConfigs.model_validate({"configs": input.output_configs}).configs
        )
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))

    user_id = context.user_id
    source = input.prompt_source
    if source.content is not None:
        source.content.user_id = user_id

    try:
        async with context.db() as session:
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator_name = await generate_unique_evaluator_name(session, name)
            if source.content is not None:
                await validate_custom_provider(session, source.content)

            if isinstance(source, FromPromptVersion):
                base = await get_prompt_version(session, source.prompt_version_id)
                prompt = await session.get(models.Prompt, base.prompt_id)
                if prompt is None:
                    raise NotFound("Prompt for the selected version was not found")
                prompt_version = await pin_prompt_version(
                    session, base=base, content=source.content, prompt_id=prompt.id
                )
            else:
                prompt_version = source.content
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
            await ensure_evaluator_prompt_label(session, prompt.id)
            evaluator.prompt_version_tag = models.PromptVersionTag(
                name=IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}"),
                prompt_id=prompt.id,
                prompt_version_id=prompt_version.id,
            )
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator.id,
                trace_project=get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
                input_mapping=input.input_mapping,
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict(f"A project evaluator named '{input.name}' already exists for this project")

    return project_evaluator


async def update_project_llm_evaluator(
    context: EvaluatorServiceContext, input: UpdateProjectLLMEvaluatorInput
) -> models.ProjectEvaluator:
    """Update an LLM binding and shared definition in one transaction."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, "ProjectEvaluator"
        )
    except ValueError:
        raise BadRequest(f"Invalid project evaluator id: {input.project_evaluator_id}")
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    if input.enabled is None:
        raise BadRequest("enabled cannot be set to null")
    if input.evaluation_delay_seconds is not UNSET:
        materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
    try:
        name = IdentifierModel.model_validate(input.name)
        require_categorical_output_configs(input.output_configs)
        output_configs = list(
            LLMEvaluatorOutputConfigs.model_validate({"configs": input.output_configs}).configs
        )
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))

    user_id = context.user_id
    if input.prompt_source.content is not None:
        input.prompt_source.content.user_id = user_id

    cleared: dict[models.EvaluationTarget, int] = {}
    try:
        async with context.db() as session:
            # Tag moves and evaluator edits lock the evaluator row first, so each validates
            # against the other's committed state.
            evaluator_id = await session.scalar(
                select(models.ProjectEvaluator.evaluator_id).where(
                    models.ProjectEvaluator.id == project_evaluator_id
                )
            )
            if evaluator_id is not None:
                await session.get(models.LLMEvaluator, evaluator_id, with_for_update=True)
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
            validate_project_evaluator_target_update(
                project_evaluator,
                input.evaluation_target,
            )
            shared_evaluator_changed = False
            if project_evaluator.name != name and await is_sole_evaluator_binding(
                session, evaluator.id
            ):
                evaluator.name = await generate_unique_evaluator_name(session, name)
                shared_evaluator_changed = True

            prompt_version = await update_llm_definition(
                session,
                evaluator,
                prompt_source=input.prompt_source,
                output_configs=output_configs,
                description=input.description,
                name=name,
                user_id=user_id,
                shared_evaluator_changed=shared_evaluator_changed,
            )
            await reject_incompatible_dataset_overrides(session, evaluator, prompt_version)

            binding_values: dict[str, Any] = dict(
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
                input_mapping=input.input_mapping,
            )
            if input.evaluation_delay_seconds is not UNSET:
                binding_values["evaluation_delay_seconds"] = (
                    materialize_project_evaluator_evaluation_delay(
                        input.evaluation_delay_seconds, input.evaluation_target
                    )
                )
            if input.enabled is not UNSET:
                assert input.enabled is not None
                binding_values["enabled"] = input.enabled
            cleared = await _drop_queued_work_on_enabled_change(
                session, project_evaluator, input.enabled
            )
            project_evaluator = await _write_project_evaluator(
                session, project_evaluator.id, binding_values
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict(f"A project evaluator named '{input.name}' already exists for this project")
    count_cleared_work(cleared)

    return project_evaluator


async def add_project_code_evaluator(
    context: EvaluatorServiceContext, input: AddProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Bind an existing code evaluator to a project without copying its definition."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project id: {input.project_id}")
    try:
        evaluator_id, evaluator_kind = parse_evaluator_id(input.evaluator_id)
    except ValueError as error:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {error}")
    if evaluator_kind != "CODE":
        raise BadRequest("Evaluator must be a CODE evaluator")
    try:
        name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(str(error))
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )

    try:
        async with context.db() as session:
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            if await session.get(models.CodeEvaluator, evaluator_id) is None:
                raise NotFound(f"Code evaluator with id {input.evaluator_id} not found")
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator_id,
                trace_project=get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
                input_mapping=(input.input_mapping if input.input_mapping is not None else None),
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict(f"A project evaluator named '{input.name}' already exists for this project")

    return project_evaluator


async def add_project_evaluator(
    context: EvaluatorServiceContext, input: AddProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Bind an existing LLM or code evaluator to a project.

    The evaluator row is locked so a concurrent definition delete sees the binding. A name the
    project already uses is refused with AlreadyExists naming the binding that holds it.
    """
    project_id = _decode_project_id(input.project_id)
    try:
        evaluator_id, evaluator_kind = parse_evaluator_id(input.evaluator_id)
    except ValueError as error:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {error}")
    if evaluator_kind not in ("LLM", "CODE"):
        raise BadRequest("Projects run LLM and code evaluators")
    try:
        name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(str(error))
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )
    evaluator_model = models.LLMEvaluator if evaluator_kind == "LLM" else models.CodeEvaluator
    try:
        async with context.db() as session:
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator = await session.get(evaluator_model, evaluator_id, with_for_update=True)
            if evaluator is None:
                raise NotFound(f"Evaluator not found: {input.evaluator_id}")
            if isinstance(evaluator, models.LLMEvaluator) and (
                await resolve_evaluator_prompt_version(session, evaluator) is None
            ):
                raise NotFound(f"Prompt version not found for evaluator {input.evaluator_id}")
            project_evaluator = models.ProjectEvaluator(
                project_id=project_id,
                evaluator_id=evaluator_id,
                trace_project=get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
                input_mapping=input.input_mapping,
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await _project_binding_name_taken(context, project_id, name) from error
    return project_evaluator


def _decode_project_id(project_id: GlobalID) -> int:
    try:
        return from_global_id_with_expected_type(project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project id: {project_id}")


async def _project_binding_name_taken(
    context: EvaluatorServiceContext, project_id: int, name: Identifier
) -> Conflict:
    async with context.db() as session:
        existing_id = await session.scalar(
            select(models.ProjectEvaluator.id).where(
                models.ProjectEvaluator.project_id == project_id,
                models.ProjectEvaluator.name == name,
            )
        )
    if existing_id is None:
        return Conflict(f"Could not bind evaluator '{name.root}' because of a conflicting resource")
    return AlreadyExists(
        f"A project evaluator named '{name.root}' already exists for this project",
        existing_id=str(GlobalID("ProjectEvaluator", str(existing_id))),
    )


async def detach_project_evaluators(
    context: EvaluatorServiceContext,
    project_evaluator_ids: list[GlobalID],
    *,
    project_id: Optional[GlobalID] = None,
) -> None:
    """Delete bindings and their trace projects while preserving shared definitions and prompts.

    Missing bindings are ignored. With a project, a binding of another project is refused
    before any change.
    """
    rowids: list[int] = []
    for global_id in project_evaluator_ids:
        try:
            rowids.append(from_global_id_with_expected_type(global_id, "ProjectEvaluator"))
        except ValueError:
            raise BadRequest(f"Invalid project evaluator id: {global_id}")
    async with context.db() as session:
        if project_id is not None:
            elsewhere = (
                await session.scalars(
                    select(models.ProjectEvaluator.id).where(
                        models.ProjectEvaluator.id.in_(rowids),
                        models.ProjectEvaluator.project_id != _decode_project_id(project_id),
                    )
                )
            ).all()
            if elsewhere:
                listed = ", ".join(str(GlobalID("ProjectEvaluator", str(i))) for i in elsewhere)
                raise BadRequest(f"These bindings belong to another project: {listed}")

        trace_project_ids = (
            await session.scalars(
                delete(models.ProjectEvaluator)
                .where(models.ProjectEvaluator.id.in_(rowids))
                .returning(models.ProjectEvaluator.trace_project_id)
            )
        ).all()
        if trace_project_ids:
            await delete_projects_and_evaluator_trace_projects(session, trace_project_ids)


async def create_project_code_evaluator(
    context: EvaluatorServiceContext, input: CreateProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Validate code and create its definition, initial version, and project binding."""
    try:
        project_id = from_global_id_with_expected_type(input.project_id, "Project")
        name = IdentifierModel.model_validate(input.name)
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    evaluation_delay_seconds = materialize_project_evaluator_evaluation_delay(
        input.evaluation_delay_seconds, input.evaluation_target
    )
    raise_on_uninferable_evaluate_signature(input.source_code, input.language)
    require_output_configs(input.output_configs or [])
    output_configs = cast(list[AnnotationConfigType], input.output_configs)

    user_id = context.user_id

    # Validate outside the write transaction to avoid nested sessions.
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
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator_name = await generate_unique_evaluator_name(session, name)
            evaluator = models.CodeEvaluator(
                name=evaluator_name,
                description=input.description,
                language=input.language,
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
                trace_project=get_trace_project_for_project_evaluator(
                    project_name=project.name,
                    project_evaluator_name=name.root,
                ),
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
                input_mapping=(input.input_mapping if input.input_mapping is not None else None),
                evaluation_delay_seconds=evaluation_delay_seconds,
                enabled=input.enabled,
            )
            session.add(project_evaluator)
            await session.flush()
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict(f"A project evaluator named '{input.name}' already exists for this project")

    return project_evaluator


async def update_project_code_evaluator(
    context: EvaluatorServiceContext, input: UpdateProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Update a code binding and its shared definition using the GraphQL edit contract."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, "ProjectEvaluator"
        )
        name = IdentifierModel.model_validate(input.name)
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
    validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
    validate_project_evaluator_sampling_rate(input.sampling_rate)
    if input.evaluator_input_mapping is None:
        raise BadRequest("evaluator_input_mapping cannot be set to null")
    if input.enabled is None:
        raise BadRequest("enabled cannot be set to null")
    if input.evaluation_delay_seconds is not UNSET:
        materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
    if input.source_code is not UNSET and input.source_code is None:
        raise BadRequest("source_code cannot be set to null")
    if input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    if input.output_configs is not UNSET:
        require_output_configs(input.output_configs)

    user_id = context.user_id

    # Validate outside the write transaction to avoid nested sessions.
    validated_sandbox_config_id: Optional[int] = None
    validated_source_code: Optional[str] = None
    # A source-only edit leaves sandbox_config_id UNSET, so it must be checked against the
    # evaluator's current sandbox, or it saves code that was never run through any sandbox.
    source_only_edit = (
        input.sandbox_config_id is UNSET
        and input.source_code is not UNSET
        and input.source_code is not None
    )
    if (input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None) or (
        source_only_edit
    ):
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
            current_sandbox_config_id = current_evaluator.sandbox_config_id
            current_with_version = await code_evaluator_with_latest_version(
                session, current_evaluator.id
            )
            stored_source_code = (
                current_with_version[1].source_code
                if current_with_version is not None and current_with_version[1] is not None
                else ""
            )
        # Validate the candidate source against the effective sandbox configuration.
        validated_source_code = (
            input.source_code
            if input.source_code is not UNSET and input.source_code is not None
            else stored_source_code
        )
        if source_only_edit:
            validated_sandbox_config_id = current_sandbox_config_id
            if validated_sandbox_config_id is not None:
                await validate_code_evaluator_sandbox_config(
                    context.db,
                    sandbox_config_global_id=GlobalID(
                        "SandboxConfig", str(validated_sandbox_config_id)
                    ),
                    language=current_language,
                    action="updating this evaluator",
                    source_code=validated_source_code,
                    sandbox_runtime=context.sandbox_runtime,
                )
        else:
            assert input.sandbox_config_id is not None
            validated_sandbox_config_id = await validate_code_evaluator_sandbox_config(
                context.db,
                sandbox_config_global_id=input.sandbox_config_id,
                language=current_language,
                action="updating this evaluator",
                source_code=validated_source_code,
                sandbox_runtime=context.sandbox_runtime,
            )

    cleared: dict[models.EvaluationTarget, int] = {}
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
            validate_project_evaluator_target_update(
                project_evaluator,
                input.evaluation_target,
            )
            shared_evaluator_changed = False
            if project_evaluator.name != name and await is_sole_evaluator_binding(
                session, evaluator.id
            ):
                evaluator.name = await generate_unique_evaluator_name(session, name)
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
                    if input.source_code is UNSET or input.source_code is None:
                        # A version deployed during validation was never checked against
                        # this sandbox.
                        latest = await code_evaluator_with_latest_version(session, evaluator.id)
                        latest_source_code = (
                            latest[1].source_code
                            if latest is not None and latest[1] is not None
                            else ""
                        )
                        if latest_source_code != validated_source_code:
                            raise Conflict(
                                "The evaluator version changed during sandbox validation; retry."
                            )
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
                raise_on_uninferable_evaluate_signature(input.source_code, evaluator.language)
                if source_only_edit and evaluator.sandbox_config_id != validated_sandbox_config_id:
                    raise Conflict("The evaluator sandbox changed during source validation; retry.")
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

            binding_values: dict[str, Any] = dict(
                name=name,
                filter_condition=input.filter_condition,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target,
            )
            if input.input_mapping is not UNSET:
                binding_values["input_mapping"] = input.input_mapping
            if input.evaluation_delay_seconds is not UNSET:
                binding_values["evaluation_delay_seconds"] = (
                    materialize_project_evaluator_evaluation_delay(
                        input.evaluation_delay_seconds, input.evaluation_target
                    )
                )
            if input.enabled is not UNSET:
                assert input.enabled is not None
                binding_values["enabled"] = input.enabled
            cleared = await _drop_queued_work_on_enabled_change(
                session, project_evaluator, input.enabled
            )
            project_evaluator = await _write_project_evaluator(
                session, project_evaluator.id, binding_values
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError):
        raise Conflict(f"A project evaluator named '{input.name}' already exists for this project")
    count_cleared_work(cleared)

    return project_evaluator


async def _drop_queued_work_on_enabled_change(
    session: AsyncSession,
    project_evaluator: models.ProjectEvaluator,
    enabled: Any,
) -> dict[models.EvaluationTarget, int]:
    """Drop this evaluator's queued work when its enabled flag changes.

    Saving the same value drops nothing. The caller counts the result after the transaction
    commits.
    """
    if enabled is UNSET or enabled is None or project_evaluator.enabled == enabled:
        return {}
    return await drop_queued_work(session, [project_evaluator.id])


async def _write_project_evaluator(
    session: AsyncSession, project_evaluator_id: int, values: dict[str, Any]
) -> models.ProjectEvaluator:
    """Update binding columns and return the row as the database stored it.

    The row is handed to resolvers after the session closes, so server-generated values
    such as updated_at must come back with the write instead of being loaded lazily.
    """
    row: models.ProjectEvaluator | None = await session.scalar(
        update(models.ProjectEvaluator)
        .where(models.ProjectEvaluator.id == project_evaluator_id)
        .values(**values)
        .returning(models.ProjectEvaluator)
    )
    assert row is not None
    return row


async def set_project_evaluator_enabled(
    context: EvaluatorServiceContext, input: SetProjectEvaluatorEnabledInput
) -> models.ProjectEvaluator:
    """Enable or disable a binding without changing its other settings.

    Changing the flag clears the evaluator's queued evaluations. Saving the same value
    drops nothing.
    """
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, "ProjectEvaluator"
        )
    except ValueError as error:
        raise BadRequest(str(error))
    async with context.db() as session:
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        if project_evaluator is None:
            raise NotFound(f"Project evaluator not found: {input.project_evaluator_id}")
        cleared = await _drop_queued_work_on_enabled_change(
            session, project_evaluator, input.enabled
        )
        project_evaluator = await _write_project_evaluator(
            session, project_evaluator.id, {"enabled": input.enabled}
        )
    count_cleared_work(cleared)
    return project_evaluator


async def clear_queued_evaluations(
    context: EvaluatorServiceContext, project_id: GlobalID
) -> tuple[int, models.Project]:
    """Clear queued evaluations for every evaluator in one project.

    Evaluations already running are left alone. Returns how many were cleared and the project.
    """
    try:
        project_rowid = from_global_id_with_expected_type(project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project id: {project_id}")
    async with context.db() as session:
        project = await session.get(models.Project, project_rowid)
        if project is None:
            raise NotFound(f"Project not found: {project_id}")
        project_evaluator_ids = list(
            await session.scalars(
                select(models.ProjectEvaluator.id).where(
                    models.ProjectEvaluator.project_id == project_rowid
                )
            )
        )
        dropped = await drop_queued_work(session, project_evaluator_ids)
    count_cleared_work(dropped)
    return sum(dropped.values()), project


async def clear_all_queued_evaluations(context: EvaluatorServiceContext) -> int:
    """Clear queued evaluations for every evaluator in every project.

    Evaluations already running are left alone.
    """
    async with context.db() as session:
        dropped = await drop_all_queued_work(session)
    count_cleared_work(dropped)
    return sum(dropped.values())


async def delete_project_evaluators(
    context: EvaluatorServiceContext, input: DeleteProjectEvaluatorsInput
) -> list[GlobalID]:
    """Delete bindings and their trace projects, collecting unreferenced definitions."""
    project_evaluator_ids: list[int] = []
    for global_id in input.project_evaluator_ids:
        try:
            project_evaluator_ids.append(
                from_global_id_with_expected_type(global_id, "ProjectEvaluator")
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
            deleted_ids.append(GlobalID("ProjectEvaluator", str(project_evaluator_id)))
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
            await garbage_collect_evaluators(
                session,
                evaluator_ids=evaluator_ids,
                prompt_ids=prompt_ids,
                delete_associated_prompt=input.delete_associated_prompt,
            )

    return deleted_ids


@dataclass(kw_only=True)
class ProjectEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    sampling_rate: Optional[float] = UNSET
    filter_condition: Optional[str] = UNSET
    enabled: Optional[bool] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    evaluation_delay_seconds: Optional[int] = UNSET


async def patch_project_evaluator(
    context: EvaluatorServiceContext,
    project_evaluator_id: GlobalID,
    patch: ProjectEvaluatorPatch,
) -> models.ProjectEvaluator:
    """Update binding settings without modifying the shared evaluator definition."""
    try:
        row_id = from_global_id_with_expected_type(project_evaluator_id, "ProjectEvaluator")
    except ValueError as error:
        raise BadRequest(f"Invalid project evaluator id: {project_evaluator_id}") from error
    cleared: dict[models.EvaluationTarget, int] = {}
    try:
        async with context.db() as session:
            row = await session.get(models.ProjectEvaluator, row_id)
            if row is None:
                raise NotFound(f"Project evaluator not found: {project_evaluator_id}")
            project_rowid = row.project_id
            target = row.evaluation_target
            values: dict[str, Any] = {}
            if patch.name is not UNSET:
                values["name"] = IdentifierModel.model_validate(patch.name)
            if patch.sampling_rate is not UNSET:
                assert patch.sampling_rate is not None
                validate_project_evaluator_sampling_rate(patch.sampling_rate)
                values["sampling_rate"] = patch.sampling_rate
            if patch.filter_condition is not UNSET:
                assert patch.filter_condition is not None
                validate_project_evaluator_filter(patch.filter_condition, target)
                values["filter_condition"] = patch.filter_condition
            cleared = await _drop_queued_work_on_enabled_change(session, row, patch.enabled)
            if patch.enabled is not UNSET:
                assert patch.enabled is not None
                values["enabled"] = patch.enabled
            if patch.input_mapping is not UNSET:
                values["input_mapping"] = patch.input_mapping
            if patch.evaluation_delay_seconds is not UNSET:
                values["evaluation_delay_seconds"] = materialize_project_evaluator_evaluation_delay(
                    patch.evaluation_delay_seconds, target
                )
            if values:
                row = await _write_project_evaluator(session, row.id, values)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        if patch.name is not UNSET and patch.name is not None:
            raise await _project_binding_name_taken(context, project_rowid, patch.name) from error
        raise Conflict(
            "A project evaluator with this name already exists for this project"
        ) from error
    count_cleared_work(cleared)
    return row
