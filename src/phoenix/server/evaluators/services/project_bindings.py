"""Operations for binding evaluator definitions to projects."""

from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence, TypedDict, Union

from pydantic import ValidationError
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.db.eval_work import queued_index_predicate
from phoenix.db.helpers import (
    code_evaluator_with_latest_version,
    delete_projects_and_evaluator_trace_projects,
)
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.evaluators.services.definitions import (
    EvaluatorServiceContext,
    ValidatedCode,
    check_output_configs,
    create_code_definition,
    create_llm_definition,
    preflight_code,
    update_code_definition,
    update_llm_definition,
)
from phoenix.server.evaluators.services.management import (
    EVALUATOR_MODEL_BY_KIND,
    garbage_collect_evaluators,
    generate_unique_evaluator_name,
    get_trace_project_for_project_evaluator,
    is_sole_evaluator_binding,
    lock_evaluators,
    materialize_project_evaluator_evaluation_delay,
    parse_evaluator_id,
    validate_project_evaluator_filter,
    validate_project_evaluator_project,
    validate_project_evaluator_sampling_rate,
    validate_project_evaluator_target_update,
)
from phoenix.server.evaluators.services.prompt_source import (
    CreatePromptSource,
    UpdatePromptSource,
    resolve_evaluator_prompt_version,
)
from phoenix.server.evaluators.validation import (
    PROJECT_EVALUATOR_CONTEXT_KEYS,
    validate_decision_input_mapping,
)
from phoenix.server.online_eval.project_evaluator_state import (
    start_at_database_time,
    start_at_span_cursor,
)
from phoenix.server.online_eval.work_tables import WORK_TABLES, WorkUnitModel
from phoenix.server.prometheus import ONLINE_EVAL_COMPLETED_WORK_UNITS
from phoenix.server.types import DbSessionFactory


class ProjectEvaluatorWriteValues(TypedDict, total=False):
    name: Identifier
    filter_condition: str
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
    input_mapping: Optional[InputMapping]
    evaluation_delay_seconds: Optional[int]
    enabled: bool
    tracing_enabled: bool


@dataclass(kw_only=True)
class ProjectBindingSettings:
    project_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: models.EvaluationTarget
    input_mapping: Optional[InputMapping] = None
    filter_condition: str = ""
    enabled: bool = True
    tracing_enabled: bool = True
    evaluation_delay_seconds: Optional[int] = None


@dataclass(kw_only=True)
class ProjectEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    sampling_rate: Optional[float] = UNSET
    filter_condition: Optional[str] = UNSET
    enabled: Optional[bool] = UNSET
    tracing_enabled: Optional[bool] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    evaluation_delay_seconds: Optional[int] = UNSET


@dataclass(kw_only=True)
class CreateProjectLLMEvaluatorInput(ProjectBindingSettings):
    prompt_source: CreatePromptSource
    output_configs: list[OutputConfigType]
    description: Optional[str] = None
    input_schema: Any = None  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class UpdateProjectLLMEvaluatorInput(ProjectEvaluatorPatch):
    project_evaluator_id: GlobalID
    evaluation_target: models.EvaluationTarget
    prompt_source: UpdatePromptSource
    output_configs: list[OutputConfigType]
    description: Optional[str] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class AddProjectCodeEvaluatorInput(ProjectBindingSettings):
    evaluator_id: GlobalID


@dataclass(kw_only=True)
class CreateProjectCodeEvaluatorInput(ProjectBindingSettings):
    source_code: str
    language: models.LanguageName
    sandbox_config_id: GlobalID
    evaluator_input_mapping: InputMapping
    description: Optional[str] = None
    output_configs: Optional[list[OutputConfigType]] = None
    input_schema: Any = None  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class UpdateProjectCodeEvaluatorInput(ProjectEvaluatorPatch):
    project_evaluator_id: GlobalID
    evaluation_target: models.EvaluationTarget
    evaluator_input_mapping: Optional[InputMapping] = UNSET
    description: Optional[str] = UNSET
    source_code: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service


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
    project_id, values = check_project_binding(input)
    output_configs = check_output_configs("LLM", input.output_configs)
    try:
        async with context.db() as session:
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator = await create_llm_definition(
                session,
                name=await generate_unique_evaluator_name(session, values["name"]),
                prompt_source=input.prompt_source,
                output_configs=output_configs,
                user_id=context.user_id,
                description=input.description,
                input_schema=input.input_schema,
                binding_name=values["name"],
            )
            project_evaluator = await bind_project_evaluator(session, project, evaluator, values)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await project_binding_name_taken(context, project_id, values["name"]) from error
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
    try:
        name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(str(error))
    output_configs = check_output_configs("LLM", input.output_configs)

    await clear_queue_before_enabling(context.db, project_evaluator_id, input.enabled)
    project_id: Optional[int] = None
    try:
        async with context.db() as session:
            # Edits and deletes take the evaluator row first, so they queue instead of deadlocking.
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
            project_id = project_evaluator.project_id
            validate_project_evaluator_target_update(project_evaluator, input.evaluation_target)
            shared_evaluator_changed = False
            if project_evaluator.name != name and await is_sole_evaluator_binding(
                session, evaluator.id
            ):
                evaluator.name = await generate_unique_evaluator_name(session, name)
                shared_evaluator_changed = True
            await update_llm_definition(
                session,
                evaluator,
                prompt_source=input.prompt_source,
                output_configs=output_configs,
                description=input.description,
                name=name,
                user_id=context.user_id,
                shared_evaluator_changed=shared_evaluator_changed,
                input_schema=input.input_schema,
            )
            project_evaluator = await apply_project_evaluator_patch(
                session, project_evaluator, input
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        assert project_id is not None
        raise await project_binding_name_taken(
            context, project_id, name, binding_id=project_evaluator_id
        ) from error
    return project_evaluator


async def add_project_code_evaluator(
    context: EvaluatorServiceContext, input: AddProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Bind an existing code evaluator to a project without copying its definition."""
    try:
        _, evaluator_kind = parse_evaluator_id(input.evaluator_id)
    except ValueError as error:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {error}")
    if evaluator_kind != "CODE":
        raise BadRequest("Evaluator must be a CODE evaluator")
    return await add_project_evaluator(context, input.evaluator_id, input)


async def add_project_evaluator(
    context: EvaluatorServiceContext, evaluator_id: GlobalID, settings: ProjectBindingSettings
) -> models.ProjectEvaluator:
    """Bind an existing LLM, code, or decision evaluator to a project.

    The evaluator row is locked so a concurrent definition delete sees the binding. A name the
    project already uses is refused with AlreadyExists naming the binding that holds it.
    """
    try:
        evaluator_rowid, evaluator_kind = parse_evaluator_id(evaluator_id)
    except ValueError as error:
        raise BadRequest(f"Invalid evaluator id: {evaluator_id}. {error}")
    if evaluator_kind not in ("LLM", "CODE", "DECISION"):
        raise BadRequest("Projects run LLM, code, and decision evaluators")
    project_id, values = check_project_binding(settings)
    evaluator_model = EVALUATOR_MODEL_BY_KIND[evaluator_kind]
    try:
        async with context.db() as session:
            project = await validate_project_evaluator_project(
                session, project_id, settings.project_id
            )
            evaluator = await session.get(evaluator_model, evaluator_rowid, with_for_update=True)
            if evaluator is None:
                if evaluator_kind == "CODE":
                    raise NotFound(f"Code evaluator with id {evaluator_id} not found")
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            if isinstance(evaluator, models.LLMEvaluator) and (
                await resolve_evaluator_prompt_version(session, evaluator) is None
            ):
                raise NotFound(f"Prompt version not found for evaluator {evaluator_id}")
            project_evaluator = await bind_project_evaluator(session, project, evaluator, values)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await project_binding_name_taken(context, project_id, values["name"]) from error
    return project_evaluator


def check_project_binding(
    settings: ProjectBindingSettings,
) -> tuple[int, ProjectEvaluatorWriteValues]:
    """Refuse settings that are invalid whatever the database holds; returns the project's id
    and the values a new binding is written with."""
    project_id = _decode_project_id(settings.project_id)
    values = project_binding_values(settings, settings.evaluation_target)
    values["evaluation_target"] = settings.evaluation_target
    return project_id, values


def project_binding_values(
    settings: Union[ProjectBindingSettings, ProjectEvaluatorPatch],
    evaluation_target: models.EvaluationTarget,
) -> ProjectEvaluatorWriteValues:
    """Check binding settings for a binding of this target and return the values to write.
    A setting left UNSET is left out, and None resets the evaluation delay to its default."""
    for field in ("name", "sampling_rate", "filter_condition", "enabled", "tracing_enabled"):
        if getattr(settings, field) is None:
            raise BadRequest(f"{field} cannot be set to null")
    values = ProjectEvaluatorWriteValues()
    if settings.name is not UNSET:
        try:
            values["name"] = Identifier.model_validate(settings.name)
        except ValidationError as error:
            raise BadRequest(str(error))
    if settings.filter_condition is not UNSET:
        assert settings.filter_condition is not None
        validate_project_evaluator_filter(settings.filter_condition, evaluation_target)
        values["filter_condition"] = settings.filter_condition
    if settings.sampling_rate is not UNSET:
        assert settings.sampling_rate is not None
        validate_project_evaluator_sampling_rate(settings.sampling_rate)
        values["sampling_rate"] = settings.sampling_rate
    if settings.evaluation_delay_seconds is not UNSET:
        values["evaluation_delay_seconds"] = materialize_project_evaluator_evaluation_delay(
            settings.evaluation_delay_seconds, evaluation_target
        )
    if settings.enabled is not UNSET:
        assert settings.enabled is not None
        values["enabled"] = settings.enabled
    if settings.tracing_enabled is not UNSET:
        assert settings.tracing_enabled is not None
        values["tracing_enabled"] = settings.tracing_enabled
    if settings.input_mapping is not UNSET:
        values["input_mapping"] = settings.input_mapping
    return values


async def bind_project_evaluator(
    session: AsyncSession,
    project: models.Project,
    evaluator: models.Evaluator,
    values: ProjectEvaluatorWriteValues,
) -> models.ProjectEvaluator:
    """Bind an evaluator to a project with its own trace project, writing the values
    check_project_binding returned."""
    if isinstance(evaluator, models.DecisionEvaluator):
        validate_decision_project_mapping(evaluator.selected_version, values.get("input_mapping"))
    project_evaluator = models.ProjectEvaluator(
        project_id=project.id,
        evaluator_id=evaluator.id,
        trace_project=get_trace_project_for_project_evaluator(
            project_name=project.name,
            project_evaluator_name=values["name"].root,
        ),
        **values,
    )
    session.add(project_evaluator)
    await session.flush()
    await _start_new_evaluator(session, project_evaluator)
    return project_evaluator


def validate_decision_project_mapping(
    version: models.DecisionVersion, input_mapping: Optional[InputMapping]
) -> None:
    """A judge's inputs must all be fillable from the span, trace, or session it judges."""
    validate_decision_input_mapping(
        version,
        input_mapping,
        context_keys=PROJECT_EVALUATOR_CONTEXT_KEYS,
        context="evaluated span, trace, or session",
    )


def _decode_project_id(project_id: GlobalID) -> int:
    try:
        return from_global_id_with_expected_type(project_id, "Project")
    except ValueError:
        raise BadRequest(f"Invalid project id: {project_id}")


async def project_binding_name_taken(
    context: EvaluatorServiceContext,
    project_id: int,
    name: Optional[Identifier],
    *,
    binding_id: Optional[int] = None,
) -> Conflict:
    """The error for a project binding write the database refused: AlreadyExists when
    another binding of the project holds the name, otherwise a conflicting resource. An edit
    passes its binding's id, so the binding is never reported as holding its own name."""
    existing_id: Optional[int] = None
    if name is not UNSET and name is not None:
        name = Identifier.model_validate(name)
        query = select(models.ProjectEvaluator.id).where(
            models.ProjectEvaluator.project_id == project_id,
            models.ProjectEvaluator.name == name,
        )
        if binding_id is not None:
            query = query.where(models.ProjectEvaluator.id != binding_id)
        async with context.db() as session:
            existing_id = await session.scalar(query)
    if existing_id is not None:
        assert name is not None
        return AlreadyExists(
            f"A project evaluator named '{name.root}' already exists for this project",
            existing_id=str(GlobalID("ProjectEvaluator", str(existing_id))),
        )
    if binding_id is not None:
        return Conflict("Could not update the project evaluator because of a conflicting resource")
    return Conflict(f"Could not bind evaluator '{name}' because of a conflicting resource")


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
    project_id, values = check_project_binding(input)
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
            project = await validate_project_evaluator_project(
                session, project_id, input.project_id
            )
            evaluator = await create_code_definition(
                session,
                name=await generate_unique_evaluator_name(session, values["name"]),
                code=code,
                input_mapping=input.evaluator_input_mapping,
                output_configs=output_configs,
                user_id=context.user_id,
                description=input.description,
                input_schema=input.input_schema,
            )
            project_evaluator = await bind_project_evaluator(session, project, evaluator, values)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await project_binding_name_taken(context, project_id, values["name"]) from error
    return project_evaluator


async def update_project_code_evaluator(
    context: EvaluatorServiceContext, input: UpdateProjectCodeEvaluatorInput
) -> models.ProjectEvaluator:
    """Update a code binding and its shared definition using the GraphQL edit contract.

    New source, or a new sandbox, is run through the sandbox before the write. A deploy that
    lands in between is overwritten, as any later edit would overwrite it."""
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, "ProjectEvaluator"
        )
        name = Identifier.model_validate(input.name)
    except ValueError as error:
        raise BadRequest(str(error))
    evaluator_input_mapping = input.evaluator_input_mapping
    if evaluator_input_mapping is None:
        raise BadRequest("evaluator_input_mapping cannot be set to null")
    if input.source_code is None:
        raise BadRequest("source_code cannot be set to null")
    if input.output_configs is None:
        raise BadRequest("output_configs cannot be set to null")
    output_configs = (
        check_output_configs("CODE", input.output_configs)
        if input.output_configs is not UNSET
        else UNSET
    )

    new_source = input.source_code is not UNSET
    validated: Optional[ValidatedCode] = None
    if new_source or (input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None):
        async with context.db() as session:
            current = await session.scalar(
                select(models.CodeEvaluator)
                .join(
                    models.ProjectEvaluator,
                    models.ProjectEvaluator.evaluator_id == models.CodeEvaluator.id,
                )
                .where(models.ProjectEvaluator.id == project_evaluator_id)
            )
            if current is None:
                raise NotFound(f"CODE project evaluator not found: {input.project_evaluator_id}")
            current_with_version = await code_evaluator_with_latest_version(session, current.id)
            stored_source_code = (
                current_with_version[1].source_code
                if current_with_version is not None and current_with_version[1] is not None
                else ""
            )
        sandbox_config_id = input.sandbox_config_id
        if sandbox_config_id is UNSET:
            sandbox_config_id = (
                GlobalID("SandboxConfig", str(current.sandbox_config_id))
                if current.sandbox_config_id is not None
                else None
            )
        validated = await preflight_code(
            context,
            source_code=input.source_code if new_source else stored_source_code,
            language=current.language,
            sandbox_config_id=sandbox_config_id,
            action="updating this evaluator",
            new_source=new_source,
        )

    await clear_queue_before_enabling(context.db, project_evaluator_id, input.enabled)
    project_id: Optional[int] = None
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
            project_id = project_evaluator.project_id
            validate_project_evaluator_target_update(project_evaluator, input.evaluation_target)
            shared_evaluator_changed = False
            if project_evaluator.name != name and await is_sole_evaluator_binding(
                session, evaluator.id
            ):
                evaluator.name = await generate_unique_evaluator_name(session, name)
                shared_evaluator_changed = True
            sandbox_config_rowid: Optional[int] = UNSET
            if input.sandbox_config_id is None:
                sandbox_config_rowid = None
            elif input.sandbox_config_id is not UNSET:
                assert validated is not None
                sandbox_config_rowid = validated.sandbox_config_id
            update = await update_code_definition(
                session,
                evaluator,
                user_id=context.user_id,
                source_code=input.source_code,
                description=input.description,
                sandbox_config_id=sandbox_config_rowid,
                input_mapping=evaluator_input_mapping,
                output_configs=output_configs,
                input_schema=input.input_schema,
            )
            if shared_evaluator_changed or update.changed:
                evaluator.user_id = context.user_id
            project_evaluator = await apply_project_evaluator_patch(
                session, project_evaluator, input
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        assert project_id is not None
        raise await project_binding_name_taken(
            context, project_id, name, binding_id=project_evaluator_id
        ) from error
    return project_evaluator


async def _start_new_evaluator(
    session: AsyncSession, project_evaluator: models.ProjectEvaluator
) -> None:
    """Start a new span evaluator at the span cursor, so it evaluates only spans that arrive
    after it is created. Trace and session evaluators start at their creation time instead,
    which needs no row."""
    if project_evaluator.evaluation_target == "SPAN":
        await start_at_span_cursor(session, project_evaluator.id)


async def write_project_evaluator(
    session: AsyncSession, project_evaluator_id: int, values: ProjectEvaluatorWriteValues
) -> models.ProjectEvaluator:
    """Update binding columns and return the row as the database stored it.

    An evaluator evaluates only what arrives after it is turned on. Enabling one starts it at
    now, and a span evaluator also starts at now when its filter or sampling rate changes.
    A caller that may enable an evaluator first clears its queue with
    ``clear_queue_before_enabling``, outside this transaction.

    The row is handed to resolvers after the session closes, so server-generated values
    such as updated_at must come back with the write instead of being loaded lazily.
    """
    project_evaluator = models.ProjectEvaluator
    enabled, filter_condition, sampling_rate, evaluation_target = (
        await session.execute(
            select(
                project_evaluator.enabled,
                project_evaluator.filter_condition,
                project_evaluator.sampling_rate,
                project_evaluator.evaluation_target,
            ).where(project_evaluator.id == project_evaluator_id)
        )
    ).one()
    enabling = not enabled and values.get("enabled", enabled)
    selection_changed = (
        values.get("filter_condition", filter_condition) != filter_condition
        or values.get("sampling_rate", sampling_rate) != sampling_rate
    )
    row: models.ProjectEvaluator | None = await session.scalar(
        update(project_evaluator)
        .where(project_evaluator.id == project_evaluator_id)
        .values(**values)
        .returning(project_evaluator)
    )
    assert row is not None
    if evaluation_target == "SPAN":
        if enabling or selection_changed:
            await start_at_span_cursor(session, project_evaluator_id)
    elif enabling:
        await start_at_database_time(session, project_evaluator_id)
    return row


CLEAR_CHUNK_ROWS = 10_000


async def clear_queue_before_enabling(
    db: DbSessionFactory, project_evaluator_id: int, enabled: Optional[bool]
) -> None:
    """Before a write that enables a disabled evaluator, clear its queued work while it is
    still disabled, so nothing queued before the disable runs once it is on.

    Producers queue nothing for a disabled evaluator and the consumer drops its work, so its
    queue only shrinks until the enable commits. Each chunk of ``CLEAR_CHUNK_ROWS`` is its
    own transaction, so a long queue never holds the write lock for long.
    """
    if enabled is not True:
        return
    async with db() as session:
        currently_enabled = await session.scalar(
            select(models.ProjectEvaluator.enabled).where(
                models.ProjectEvaluator.id == project_evaluator_id
            )
        )
    if currently_enabled is not False:
        return
    for work_table in WORK_TABLES.values():
        while True:
            async with db() as session:
                cleared = await _clear_queued_work(
                    session,
                    [project_evaluator_id],
                    work_unit_models=(work_table.work_unit_model,),
                    limit=CLEAR_CHUNK_ROWS,
                )
            count_cleared_work(cleared)
            if sum(cleared.values()) < CLEAR_CHUNK_ROWS:
                break


async def set_project_evaluator_enabled(
    context: EvaluatorServiceContext, input: SetProjectEvaluatorEnabledInput
) -> models.ProjectEvaluator:
    """Enable or disable a binding without changing its other settings.

    Disabling leaves its queued evaluations in place; a disabled evaluator's are cleared,
    not run, when their turn comes, and enabling it again clears any still queued. Clear them
    now with ``clear_project_evaluator_queued_evaluations``.
    """
    try:
        project_evaluator_id = from_global_id_with_expected_type(
            input.project_evaluator_id, "ProjectEvaluator"
        )
    except ValueError as error:
        raise BadRequest(str(error))
    await clear_queue_before_enabling(context.db, project_evaluator_id, input.enabled)
    async with context.db() as session:
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
        if project_evaluator is None:
            raise NotFound(f"Project evaluator not found: {input.project_evaluator_id}")
        project_evaluator = await write_project_evaluator(
            session, project_evaluator.id, ProjectEvaluatorWriteValues(enabled=input.enabled)
        )
    return project_evaluator


async def clear_project_evaluator_queued_evaluations(
    context: EvaluatorServiceContext, project_evaluator_id: GlobalID
) -> tuple[int, models.ProjectEvaluator]:
    """Clear one evaluator's queued evaluations, whether it is enabled or not.

    Evaluations already running are left alone. Returns how many were cleared and the
    evaluator.
    """
    try:
        project_evaluator_rowid = from_global_id_with_expected_type(
            project_evaluator_id, "ProjectEvaluator"
        )
    except ValueError as error:
        raise BadRequest(str(error))
    async with context.db() as session:
        project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_rowid)
        if project_evaluator is None:
            raise NotFound(f"Project evaluator not found: {project_evaluator_id}")
        cleared = await clear_queued_work(session, [project_evaluator.id])
    count_cleared_work(cleared)
    return sum(cleared.values()), project_evaluator


async def clear_project_queued_evaluations(
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
        cleared = await clear_queued_work(session, project_evaluator_ids)
    count_cleared_work(cleared)
    return sum(cleared.values()), project


async def clear_all_queued_evaluations(context: EvaluatorServiceContext) -> int:
    """Clear queued evaluations for every evaluator in every project.

    Evaluations already running are left alone.
    """
    async with context.db() as session:
        cleared = await clear_all_queued_work(session)
    count_cleared_work(cleared)
    return sum(cleared.values())


async def clear_queued_work(
    session: AsyncSession,
    project_evaluator_ids: Sequence[int],
) -> dict[models.EvaluationTarget, int]:
    """Clear the project evaluators' work that has not started, returning how many units of
    each evaluation target.

    Queued work that has not started is PENDING, or ERROR awaiting a retry. RUNNING work is
    left alone: an enabled evaluator's evaluation should finish, and publication refuses a
    disabled one's. The status guard also skips a unit a consumer claims concurrently.
    """
    return await _clear_queued_work(session, project_evaluator_ids)


async def clear_all_queued_work(session: AsyncSession) -> dict[models.EvaluationTarget, int]:
    """Clear every project evaluator's work that has not started, returning how many units
    of each evaluation target, as ``clear_queued_work`` does for some."""
    return await _clear_queued_work(session, None)


async def _clear_queued_work(
    session: AsyncSession,
    project_evaluator_ids: Optional[Sequence[int]],
    *,
    work_unit_models: Optional[Sequence[WorkUnitModel]] = None,
    limit: Optional[int] = None,
) -> dict[models.EvaluationTarget, int]:
    """Clear the work of ``work_unit_models`` (every target's by default), at most ``limit``
    rows of each."""
    cleared: dict[models.EvaluationTarget, int] = {}
    for evaluation_target, work_table in WORK_TABLES.items():
        work_unit_model = work_table.work_unit_model
        if work_unit_models is not None and work_unit_model not in work_unit_models:
            continue
        clearable: list[Any] = [
            # SQLite reads a partial index only when the query repeats its predicate.
            text(queued_index_predicate()),
            work_unit_model.status.in_(("PENDING", "ERROR")),
        ]
        if project_evaluator_ids is not None:
            clearable.append(work_unit_model.project_evaluator_id.in_(project_evaluator_ids))
        statement = update(work_unit_model).where(*clearable)
        if limit is not None:
            statement = statement.where(
                work_unit_model.id.in_(
                    select(work_unit_model.id).where(*clearable).limit(limit).scalar_subquery()
                )
            )
        result = await session.execute(statement.values(status="DROPPED"))
        cleared[evaluation_target] = result.rowcount  # type: ignore[attr-defined]
    return cleared


def count_cleared_work(cleared: Mapping[models.EvaluationTarget, int]) -> None:
    """Count work a user cleared, once the transaction that cleared it has committed."""
    if not get_env_enable_prometheus():
        return
    for evaluation_target, count in cleared.items():
        if count:
            ONLINE_EVAL_COMPLETED_WORK_UNITS.labels(
                evaluation_target=evaluation_target, outcome="cleared"
            ).inc(count)


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
        evaluator_ids_to_lock = set(
            await session.scalars(
                select(models.ProjectEvaluator.evaluator_id).where(
                    models.ProjectEvaluator.id.in_(project_evaluator_ids)
                )
            )
        )
        await lock_evaluators(session, evaluator_ids_to_lock)
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
    await clear_queue_before_enabling(context.db, row_id, patch.enabled)
    try:
        async with context.db() as session:
            row = await session.get(models.ProjectEvaluator, row_id)
            if row is None:
                raise NotFound(f"Project evaluator not found: {project_evaluator_id}")
            project_rowid = row.project_id
            row = await apply_project_evaluator_patch(session, row, patch)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await project_binding_name_taken(
            context, project_rowid, patch.name, binding_id=row_id
        ) from error
    return row


async def apply_project_evaluator_patch(
    session: AsyncSession, row: models.ProjectEvaluator, patch: ProjectEvaluatorPatch
) -> models.ProjectEvaluator:
    """Write binding settings to a binding loaded in this session."""
    values = project_binding_values(patch, row.evaluation_target)
    if patch.input_mapping is not UNSET:
        if (decision := await session.get(models.DecisionEvaluator, row.evaluator_id)) is not None:
            validate_decision_project_mapping(decision.selected_version, patch.input_mapping)
    if values:
        row = await write_project_evaluator(session, row.id, values)
    return row
